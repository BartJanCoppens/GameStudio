// What an AI-built game is: shared by the app and the Edge Functions. Plain TypeScript, no imports
// beyond the shared design and source modules, so Deno and Vite both load it.
import { FONTS, designUsable, tokenProblems, type DesignTokens } from './design.ts';
import { PASSAGES } from './source.ts';

/** One turn of the Questions phase: the AI's question (with its choices) or the creator's answer. */
export interface BriefTurn {
  role: 'ai' | 'creator';
  text: string;
  /** An AI question's clickable answers. */
  choices?: string[];
  /** Several choices may apply together. */
  multi?: boolean;
  /** The AI declined (a house rule); the creator should try something else. */
  declined?: boolean;
}

export interface AiRole {
  kind: 'game_master' | 'opponent';
  /** Plain-language role, e.g. "a tough but fair tax inspector". */
  description: string;
  /** Moves an opponent may make; the game applies them. Empty for a game master. */
  actions: string[];
}

export interface GameGoal {
  description: string;
  target: number;
  unit: string;
}

export interface GameConcept {
  title: string;
  pitch: string;
  howToPlay: string[];
  winCondition: string;
  scoring: string;
  mode: 'solo' | 'common_goal';
  /** Present when mode is common_goal. */
  goal: GameGoal | null;
  leaderboard: boolean;
  aiRole: AiRole | null;
  /** Ids of the source passages the game rests on (PASSAGES). */
  sources: string[];
  look: { name: string; tokens: DesignTokens };
}

export const FILE_NAMES = ['index.html', 'game.js', 'style.css'] as const;
export type FileName = (typeof FILE_NAMES)[number];
export type GameFiles = Partial<Record<FileName, string>>;

/** A game's draft or live content. The AI role's hidden knowledge is stored apart (game_secrets). */
export interface GameContent {
  phase: 'questions' | 'design' | 'code' | 'ready';
  brief: BriefTurn[];
  concept: GameConcept | null;
  /** Static HTML of the main screen, shown in the Design phase. */
  mockup: string | null;
  files: GameFiles | null;
  /** The game's own content (levels, questions, cases, story set-up), read by the game through the bridge. */
  data: unknown;
}

export const EMPTY_CONTENT: GameContent = { phase: 'questions', brief: [], concept: null, mockup: null, files: null, data: null };

// ---- Checks ----

const cut = (v: unknown, max: number) => (typeof v === 'string' ? (v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v) : v);

/** The model's concept with every text trimmed to its limit and lists capped: wordiness shouldn't fail a design. */
export function normalizeConcept<T>(c: T): T {
  if (!c || typeof c !== 'object') return c;
  const o = c as Record<string, unknown>;
  const goal = o.goal as Record<string, unknown> | null;
  const ai = o.aiRole as Record<string, unknown> | null;
  const look = o.look as Record<string, unknown> | undefined;
  return {
    ...o,
    title: cut(o.title, 80),
    pitch: cut(o.pitch, 300),
    howToPlay: Array.isArray(o.howToPlay) ? o.howToPlay.slice(0, 8).map(s => cut(s, 200)) : o.howToPlay,
    winCondition: cut(o.winCondition, 300),
    scoring: cut(o.scoring, 300),
    goal: goal && typeof goal === 'object' ? { ...goal, description: cut(goal.description, 200), unit: cut(goal.unit, 40) } : goal,
    aiRole: ai && typeof ai === 'object'
      ? { ...ai, description: cut(ai.description, 500), actions: Array.isArray(ai.actions) ? ai.actions.slice(0, 12).map(a => cut(a, 40)) : ai.actions }
      : ai,
    look: look && typeof look === 'object' ? { ...look, name: cut(look.name, 60) } : look,
  } as T;
}

const str = (v: unknown, max: number, min = 1) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

/** What is wrong with a concept the AI proposed (or a browser saved); empty when it can be built. */
export function conceptProblems(c: unknown): string[] {
  const p: string[] = [];
  const o = (c ?? {}) as Record<string, unknown>;
  if (!str(o.title, 80)) p.push('The concept needs a title of up to 80 characters');
  if (!str(o.pitch, 300)) p.push('The concept needs a pitch of up to 300 characters');
  if (!Array.isArray(o.howToPlay) || !o.howToPlay.length || o.howToPlay.length > 8 || !o.howToPlay.every(s => str(s, 200))) p.push('How to play needs 1–8 short steps');
  if (!str(o.winCondition, 300)) p.push('The concept needs a way to win');
  if (!str(o.scoring, 300)) p.push('The concept needs a scoring rule');
  if (o.mode !== 'solo' && o.mode !== 'common_goal') p.push('The play mode must be solo or common goal');
  const goal = o.goal as Record<string, unknown> | null;
  if (o.mode === 'common_goal' && !(goal && str(goal.description, 200) && typeof goal.target === 'number' && goal.target > 0 && str(goal.unit, 40))) p.push('A common-goal game needs a goal with a description, a target above 0 and a unit');
  if (typeof o.leaderboard !== 'boolean') p.push('Say whether the game has a leaderboard');
  const ai = o.aiRole as Record<string, unknown> | null;
  if (ai !== null && ai !== undefined) {
    if (ai.kind !== 'game_master' && ai.kind !== 'opponent') p.push('The AI role must be a game master or an opponent');
    if (!str(ai.description, 500)) p.push('The AI role needs a description');
    if (!Array.isArray(ai.actions) || ai.actions.length > 12 || !ai.actions.every(a => str(a, 40))) p.push('An AI opponent has at most 12 moves, each a short name');
  }
  if (!Array.isArray(o.sources) || !o.sources.every(s => typeof s === 'string')) p.push('Sources must be a list of passage ids');
  else for (const s of o.sources as string[]) if (!PASSAGES.some(x => x.id === s)) p.push(`Unknown source passage ${s}`);
  const look = o.look as { name?: unknown; tokens?: unknown } | undefined;
  if (!look || !str(look.name, 60)) p.push('The look needs a name');
  else if (tokenProblems(look.tokens).length) p.push(`The look is invalid: ${tokenProblems(look.tokens)[0]}`);
  else if (!designUsable(look.tokens as DesignTokens)) p.push('The look fails the readability (contrast) checks');
  return p;
}

// ---- JSON schemas for structured outputs (every object closed, every property required) ----

const nullable = (s: object) => ({ anyOf: [s, { type: 'null' }] });
const color = { type: 'string', description: 'Hex colour #RRGGBB' };

export const TOKENS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['accent', 'accentInk', 'ink', 'muted', 'page', 'surface', 'line', 'radius', 'bodyFont', 'headingFont'],
  properties: {
    accent: color, accentInk: color, ink: color, muted: color, page: color, surface: color, line: color,
    radius: { type: 'integer' },
    bodyFont: { enum: FONTS.map(f => f.id) },
    headingFont: { enum: FONTS.map(f => f.id) },
  },
};

export const CONCEPT_FIELDS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'pitch', 'howToPlay', 'winCondition', 'scoring', 'mode', 'goal', 'leaderboard', 'aiRole', 'sources', 'look'],
  properties: {
    title: { type: 'string' },
    pitch: { type: 'string' },
    howToPlay: { type: 'array', items: { type: 'string' } },
    winCondition: { type: 'string' },
    scoring: { type: 'string' },
    mode: { enum: ['solo', 'common_goal'] },
    goal: nullable({ type: 'object', additionalProperties: false, required: ['description', 'target', 'unit'], properties: { description: { type: 'string' }, target: { type: 'number' }, unit: { type: 'string' } } }),
    leaderboard: { type: 'boolean' },
    aiRole: nullable({ type: 'object', additionalProperties: false, required: ['kind', 'description', 'actions'], properties: { kind: { enum: ['game_master', 'opponent'] }, description: { type: 'string' }, actions: { type: 'array', items: { type: 'string' } } } }),
    sources: { type: 'array', items: { enum: PASSAGES.map(x => x.id) } },
    look: { type: 'object', additionalProperties: false, required: ['name', 'tokens'], properties: { name: { type: 'string' }, tokens: TOKENS_SCHEMA } },
  },
};

/** The Questions phase: the next question, or "ready" to propose. */
export const QUESTION_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['kind', 'question'],
  properties: {
    kind: { enum: ['question', 'ready', 'declined'] },
    question: nullable({ type: 'object', additionalProperties: false, required: ['text', 'choices', 'multi'], properties: { text: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } }, multi: { type: 'boolean' } } }),
  },
};

/** The Design phase: a concept with a static mock-up of the main screen. */
export const CONCEPT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['kind', 'reply', 'concept', 'mockup_html'],
  properties: { kind: { enum: ['concept', 'declined'] }, reply: { type: 'string' }, concept: nullable(CONCEPT_FIELDS_SCHEMA), mockup_html: nullable({ type: 'string' }) },
};

/** A change request after the build: whole replacement files. */
export const CHANGE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reply', 'files', 'data_json'],
  properties: {
    reply: { type: 'string' },
    files: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'content'], properties: { name: { enum: [...FILE_NAMES] }, content: { type: 'string' } } } },
    data_json: nullable({ type: 'string' }),
  },
};

export const CHECK_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['passed', 'reasons'],
  properties: { passed: { type: 'boolean' }, reasons: { type: 'array', items: { type: 'string' } } },
};

/** What the AI says in a game; the same shape for every game. */
export const AI_REPLY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['say', 'quotes', 'action', 'mood'],
  properties: { say: { type: 'string' }, quotes: { type: 'array', items: { type: 'string' } }, action: nullable({ type: 'string' }), mood: nullable({ type: 'string' }) },
};

/** The bridge API generated games are told about (game-builder) and the platform implements (the app). */
export const BRIDGE_API = `window.GameStudio (always available; every method returns a Promise):
- GameStudio.ready(): call once when the game has loaded.
- GameStudio.getData(): the game's content (the JSON from the data step).
- GameStudio.getPlayer(): { name } (first name and initial).
- GameStudio.submitScore(score, details): the player's final score (a number, higher is better) and a small details object. Ends the run; call once.
- GameStudio.getLeaderboard(): [{ rank, name, score }] (top 10), only if the game has a leaderboard.
- GameStudio.contribute(amount, note): add 1–1000 to the common goal (common-goal games only; at most 50 times per run).
- GameStudio.getGoal(): { description, target, unit, total } (common-goal games only).
- GameStudio.askAI({ messages: [{ role: 'player' | 'ai', text }], state }): the AI role's reply { say, quotes: [{ id, heading, loc, text }], action, mood }. state: a small object describing where the player is. Games with an AI role only.
- GameStudio.getSources(): [{ id, heading, loc, text }] the linked source passages.
- GameStudio.finish(): the player is done; the platform shows the results.`;
