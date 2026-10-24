// Calling the AI model an admin chose, with structured output, for the Studio's AI features.
// Every call reports its token usage and an estimated cost, so usage limits can be enforced.
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { openAiBase, providerById, type ProviderDef } from './providers.ts';
import { resolveService } from './ai.ts';
import { HttpError, assertPublicTarget } from './server.ts';

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
/** For steps that must feel instant (the Studio's questions, in-game replies). */
const FAST_CLAUDE_MODEL = 'claude-sonnet-5-5';
/** Claude models that take the server-side refusal fallback. */
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-1'];

/**
 * List prices in US$ per million tokens: [input, output, cache read]. Cache writes are priced at 1.25 × input.
 * Estimates only; the provider's own billing is authoritative.
 */
const CLAUDE_PRICES: Record<string, [number, number, number]> = {
  'claude-fable-5-1': [10, 50, 0.25], 'claude-fable-5': [10, 50, 1],
  'claude-opus-5-5': [4, 20, 0.2], 'claude-opus-5': [5, 25, 0.5], 'claude-opus-4-8': [5, 25, 0.5], 'claude-opus-4-7': [5, 25, 0.5], 'claude-opus-4-6': [5, 25, 0.5],
  'claude-sonnet-5-5': [2, 10, 0.2], 'claude-sonnet-5': [2, 10, 0.2], 'claude-sonnet-4-6': [3, 15, 0.3],
  'claude-haiku-5-5': [0.1, 0.5, 0.01], 'claude-haiku-4-5': [1, 5, 0.1],
};

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** null when the provider's price isn't known. */
  costUsd: number | null;
}

export interface Assistant {
  def: ProviderDef;
  key: string | null;
  model: string;
  base: string | null;
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskOptions {
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  /** streamText only: a JSON schema the streamed text must follow (Claude); others are told it in the prompt. */
  schema?: unknown;
  /** With Claude, use the faster model; other providers keep the admin's choice. */
  fastModel?: boolean;
}

export interface StructuredReply {
  /** The model's JSON answer, or null when it declined. */
  json: string | null;
  usage: Usage;
}

/** The provider and model chosen in Admin › AI services; a game's own key goes before the platform's. */
export async function resolveAssistant(admin: SupabaseClient, gameKey: string | null): Promise<Assistant> {
  const { data: setting } = await admin.from('ai_settings').select('value').eq('key', 'studio_assistant').maybeSingle();
  const choice = setting?.value as { provider?: string; model?: string } | undefined;
  if (choice?.provider) {
    const resolved = await resolveService(admin, choice.provider, gameKey);
    if (!resolved) throw new HttpError(503, `The Studio assistant is set to ${providerById(choice.provider)?.name ?? choice.provider}, but it isn’t set up with a key. Fix it in Admin › AI services.`);
    const model = choice.model || resolved.row.model;
    if (!model) throw new HttpError(503, 'No model is chosen for the Studio assistant. Choose one in Admin › AI services.');
    return { def: resolved.def, key: resolved.key, model, base: resolved.def.api === 'openai' ? openAiBase(resolved.def, resolved.row.address) : null };
  }
  // Not configured: a Claude key set up in AI services, else the project's ANTHROPIC_API_KEY secret.
  const claude = await resolveService(admin, 'claude', gameKey);
  const key = claude?.key ?? Deno.env.get('ANTHROPIC_API_KEY') ?? null;
  if (!key) throw new HttpError(503, 'The Studio assistant isn’t set up yet. A platform admin can add a model in Admin › AI services.');
  return { def: providerById('claude')!, key, model: claude?.row.model || DEFAULT_CLAUDE_MODEL, base: null };
}

function claudeCost(model: string, u: { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }): number | null {
  const price = CLAUDE_PRICES[model];
  if (!price) return null;
  const [input, output, cacheRead] = price;
  const usd = ((u.input_tokens ?? 0) * input + (u.cache_creation_input_tokens ?? 0) * input * 1.25 + (u.cache_read_input_tokens ?? 0) * cacheRead + (u.output_tokens ?? 0) * output) / 1_000_000;
  return Math.round(usd * 10_000) / 10_000;
}

function claudeParams(ai: Assistant, system: string, turns: Turn[], opts: AskOptions, format?: unknown): Record<string, unknown> {
  const model = opts.fastModel ? FAST_CLAUDE_MODEL : ai.model;
  const params: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 16000,
    output_config: { effort: opts.effort ?? 'medium', ...(format ? { format } : {}) },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: turns,
  };
  // Server-side fallbacks: if a safety classifier declines, the API re-runs the request on a fallback model.
  if (FALLBACK_MODELS.includes(model)) Object.assign(params, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  return params;
}

function claudeError(ai: Assistant, e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Claude is busy. Try again in a minute.');
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new HttpError(503, 'The Claude key was rejected. Check it in Admin › AI services.');
  if (e instanceof Anthropic.NotFoundError) throw new HttpError(503, `Claude doesn’t know the model “${ai.model}”. Choose another in Admin › AI services.`);
  if (e instanceof Anthropic.APIError) { console.error('Anthropic API error', e.status, e.message); throw new HttpError(502, 'Claude returned an error. Try again.'); }
  throw e;
}

async function askClaude(ai: Assistant, system: string, turns: Turn[], schema: unknown, opts: AskOptions): Promise<StructuredReply> {
  const client = new Anthropic({ apiKey: ai.key! });
  const params = claudeParams(ai, system, turns, opts, { type: 'json_schema', schema });
  try {
    // deno-lint-ignore no-explicit-any
    const response = await client.beta.messages.create(params as any);
    // Priced by the model that answered, which a fallback may have changed.
    const usage: Usage = { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costUsd: claudeCost(response.model, response.usage) };
    if (response.stop_reason === 'refusal') return { json: null, usage };
    if (response.stop_reason === 'max_tokens') throw new HttpError(422, 'That was too big for one step. Ask for less at a time.');
    const text = response.content.find((b: { type: string }) => b.type === 'text') as { text: string } | undefined;
    if (!text) throw new HttpError(502, 'The model returned no answer');
    return { json: text.text, usage };
  } catch (e) {
    claudeError(ai, e);
  }
}

/** Any OpenAI-compatible chat API. Structured output where the server supports it, else JSON mode plus the schema in the prompt. */
async function askOpenAiCompatible(ai: Assistant, system: string, turns: Turn[], schema: unknown, schemaName: string): Promise<StructuredReply> {
  const { def, base, key, model } = ai;
  if (!base) throw new HttpError(503, `${def.name} has no address`);
  // A custom address is re-checked against DNS right before the call.
  if (!def.baseUrl) await assertPublicTarget(base);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) };
  const post = (response_format: unknown, extraSystem = '') =>
    fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system + extraSystem }, ...turns], response_format }),
      // No redirects: a public address must not bounce the server to a private one.
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    }).catch(() => { throw new HttpError(502, `Couldn’t reach ${def.name}`); });

  let r = await post({ type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } });
  if (r.status === 400 || r.status === 422) r = await post({ type: 'json_object' }, `\n\nJSON schema of the answer:\n${JSON.stringify(schema)}`);
  if (r.status >= 300 && r.status < 400) throw new HttpError(502, `${def.name} answered with a redirect; set its final address in Admin › AI services.`);
  if (r.status === 401 || r.status === 403) throw new HttpError(503, `The ${def.name} key was rejected. Check it in Admin › AI services.`);
  if (r.status === 404) throw new HttpError(503, `${def.name} doesn’t know the model “${model}”. Choose another in Admin › AI services.`);
  if (r.status === 429) throw new HttpError(429, `${def.name} is busy. Try again in a minute.`);
  if (!r.ok) throw new HttpError(502, `${def.name} returned HTTP ${r.status}. Try again.`);
  const body = await r.json().catch(() => null) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] } | null;
  const usage: Usage = { model: body?.model ?? model, inputTokens: body?.usage?.prompt_tokens ?? 0, outputTokens: body?.usage?.completion_tokens ?? 0, costUsd: null };
  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) return { json: null, usage };
  if (choice?.finish_reason === 'length') throw new HttpError(422, 'That was too big for one step. Ask for less at a time.');
  if (!choice?.message?.content) throw new HttpError(502, `${def.name} returned no answer`);
  return { json: choice.message.content, usage };
}

export function askStructured(ai: Assistant, system: string, turns: Turn[], schema: unknown, schemaName: string, opts: AskOptions = {}): Promise<StructuredReply> {
  return ai.def.api === 'anthropic' ? askClaude(ai, system, turns, schema, opts) : askOpenAiCompatible(ai, system, turns, schema, schemaName);
}

export interface StreamedText {
  text: string;
  usage: Usage;
}

/** Plain text (e.g. a code file), passed on as it is written. OpenAI-compatible providers answer in one piece. */
export async function streamText(ai: Assistant, system: string, turns: Turn[], opts: AskOptions, onDelta: (text: string) => void): Promise<StreamedText> {
  if (ai.def.api !== 'anthropic') {
    const reply = await askOpenAiText(ai, opts.schema ? `${system}\n\nAnswer with JSON only, following this schema:\n${JSON.stringify(opts.schema)}` : system, turns);
    onDelta(reply.text);
    return reply;
  }
  const client = new Anthropic({ apiKey: ai.key! });
  try {
    // deno-lint-ignore no-explicit-any
    const stream = client.beta.messages.stream(claudeParams(ai, system, turns, opts, opts.schema ? { type: 'json_schema', schema: opts.schema } : undefined) as any);
    stream.on('text', (delta: string) => onDelta(delta));
    const message = await stream.finalMessage();
    const usage: Usage = { model: message.model, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, costUsd: claudeCost(message.model, message.usage) };
    if (message.stop_reason === 'refusal') throw new HttpError(422, 'The model declined to write this. Try a different request.');
    if (message.stop_reason === 'max_tokens') throw new HttpError(422, 'The file got too long for one step. Ask for a simpler game.');
    const text = message.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    return { text, usage };
  } catch (e) {
    claudeError(ai, e);
  }
}

async function askOpenAiText(ai: Assistant, system: string, turns: Turn[]): Promise<StreamedText> {
  const { def, base, key, model } = ai;
  if (!base) throw new HttpError(503, `${def.name} has no address`);
  if (!def.baseUrl) await assertPublicTarget(base);
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...turns] }),
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  }).catch(() => { throw new HttpError(502, `Couldn’t reach ${def.name}`); });
  if (!r.ok) throw new HttpError(502, `${def.name} returned HTTP ${r.status}. Try again.`);
  const body = await r.json().catch(() => null) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { message?: { content?: string | null } }[] } | null;
  const text = body?.choices?.[0]?.message?.content;
  if (!text) throw new HttpError(502, `${def.name} returned no answer`);
  return { text, usage: { model: body?.model ?? model, inputTokens: body?.usage?.prompt_tokens ?? 0, outputTokens: body?.usage?.completion_tokens ?? 0, costUsd: null } };
}
