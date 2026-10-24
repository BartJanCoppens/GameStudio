// The AI services an admin can connect, shared by the app (Admin › AI services) and the Edge Functions.
// Plain TypeScript, no imports: Deno and Vite both load it.

export type ProviderGroup = 'model' | 'avatar' | 'voice';

export interface ProviderDef {
  id: string;
  name: string;
  group: ProviderGroup;
  description: string;
  /** 'key': needs an API key. 'none': runs locally, no key. 'optional': a key only if the server wants one. */
  auth: 'key' | 'none' | 'optional';
  /** Runs on the user's own computer: the cloud functions can't reach it, so it's tested from the browser. */
  local?: boolean;
  /** For local and custom servers: the default address, which the admin can change. */
  defaultAddress?: string;
  /** How the server talks to it. */
  api: 'anthropic' | 'openai' | 'heygen' | 'liveavatar' | 'elevenlabs';
  /** OpenAI-style base URL (…/v1) for cloud providers; local and custom ones derive it from the address. */
  baseUrl?: string;
  /** Can run the Studio assistant (needs a chat model the cloud function can reach). */
  studio: boolean;
}

export const PROVIDERS: ProviderDef[] = [
  { id: 'claude', name: 'Claude', group: 'model', description: 'Anthropic: the models Game Studio is built and tested with', auth: 'key', api: 'anthropic', studio: true },
  { id: 'openai', name: 'OpenAI', group: 'model', description: 'GPT models', auth: 'key', api: 'openai', baseUrl: 'https://api.openai.com/v1', studio: true },
  { id: 'gemini', name: 'Gemini', group: 'model', description: 'Google, through its OpenAI-compatible API', auth: 'key', api: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', studio: true },
  { id: 'openrouter', name: 'OpenRouter', group: 'model', description: 'Many models through one key', auth: 'key', api: 'openai', baseUrl: 'https://openrouter.ai/api/v1', studio: true },
  { id: 'mistral', name: 'Mistral', group: 'model', description: 'Mistral AI', auth: 'key', api: 'openai', baseUrl: 'https://api.mistral.ai/v1', studio: true },
  { id: 'groq', name: 'Groq', group: 'model', description: 'Fast open models', auth: 'key', api: 'openai', baseUrl: 'https://api.groq.com/openai/v1', studio: true },
  { id: 'deepseek', name: 'DeepSeek', group: 'model', description: 'DeepSeek', auth: 'key', api: 'openai', baseUrl: 'https://api.deepseek.com', studio: true },
  { id: 'ollama', name: 'Ollama', group: 'model', description: 'Models on this computer, no key or internet needed', auth: 'none', local: true, defaultAddress: 'http://localhost:11434', api: 'openai', studio: false },
  { id: 'lmstudio', name: 'LM Studio', group: 'model', description: 'Models on this computer, no key or internet needed', auth: 'none', local: true, defaultAddress: 'http://localhost:1234', api: 'openai', studio: false },
  { id: 'other', name: 'Other (OpenAI-compatible)', group: 'model', description: 'Any server that speaks the OpenAI API, at an https address you set', auth: 'optional', api: 'openai', studio: true },
  { id: 'heygen', name: 'HeyGen', group: 'avatar', description: 'Clips of a talking presenter, billed to your HeyGen account', auth: 'key', api: 'heygen', studio: false },
  { id: 'liveavatar', name: 'LiveAvatar', group: 'avatar', description: 'Avatars that talk with players live, billed to your LiveAvatar account by the minute', auth: 'key', api: 'liveavatar', studio: false },
  { id: 'elevenlabs', name: 'ElevenLabs', group: 'voice', description: 'Voices that read text aloud, billed to your ElevenLabs account by the character', auth: 'key', api: 'elevenlabs', studio: false },
];

export const providerById = (id: string): ProviderDef | undefined => PROVIDERS.find(p => p.id === id);

/** OpenAI-style base URL for a provider, given the address stored for it (local and custom servers). */
export function openAiBase(p: ProviderDef, address: string | null): string | null {
  if (p.baseUrl) return p.baseUrl;
  const a = (address || p.defaultAddress || '').replace(/\/+$/, '');
  if (!a) return null;
  // Local servers serve the OpenAI API under /v1; a custom address is taken as the base URL as given.
  return p.local ? `${a}/v1` : a;
}

export const GROUP_LABELS: Record<ProviderGroup, string> = { model: 'Language models', avatar: 'Avatar', voice: 'Voice' };
