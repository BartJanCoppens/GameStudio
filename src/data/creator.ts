import type { FlowNodeKind, FlowNodeState, Status } from '../ds';
import type { Cohort, DomainKey } from './shared';

export interface GameRow {
  id: string;
  title: string;
  type: string;
  platform: string;
  domain: string;
  stage: string;
  st: Status;
  version: string;
  players: number;
  updated: string;
}

export const GAMES: GameRow[] = [
  { id: 'g1', title: 'VAT rates ladder', type: 'Quiz ladder', platform: 'Browser + phone', domain: 'Belgian VAT', stage: 'Published', st: 'accepted', version: 'v3 · v4 in dev', players: 142, updated: '22 Oct · Sofie Claes' },
  { id: 'g3', title: 'Spot the invoice errors', type: 'Audit', platform: 'Browser', domain: 'Belgian VAT', stage: 'Published', st: 'accepted', version: 'v2', players: 118, updated: '14 Oct · Sofie Claes' },
  { id: 'g4', title: 'Form a judgement: the triangulation case', type: 'Reflection', platform: 'Browser', domain: 'Belgian VAT', stage: 'Review', st: 'submitted', version: 'v1', players: 0, updated: '20 Oct · awaiting Pieter Maes' },
  { id: 'g2', title: 'The Antwerp importer call', type: 'Simulation', platform: 'Browser', domain: 'Belgian VAT', stage: 'Test', st: 'in-progress', version: 'v1', players: 6, updated: '21 Oct · 3 testers' },
  { id: 'g5', title: 'Q4 VAT sprint', type: 'Team event', platform: 'Phone app', domain: 'Belgian VAT', stage: 'Dev', st: 'in-progress', version: 'v1', players: 0, updated: '19 Oct · Sofie Claes' },
  { id: 'g6', title: 'Keep the VAT file alive', type: 'Care game', platform: 'Phone app', domain: 'Belgian VAT', stage: 'Draft', st: 'not-started', version: '—', players: 0, updated: '23 Oct · Sofie Claes' },
];

/** The game open in the Studio header. `null` in state means the default, VAT rates ladder v4. */
export interface StudioGame {
  title: string;
  domain: string;
  status: Status;
  stage: string;
  structureNote: string;
}

export const DEFAULT_STUDIO_GAME: StudioGame = { title: 'VAT rates ladder', domain: 'Belgian VAT', status: 'in-progress', stage: 'Dev · v4 draft', structureNote: '4 levels · 24 questions' };

export const TEMPLATES: [string, string][] = [
  ['Quiz ladder', 'Levels, points, timer'], ['Scenario', 'Branching dialogue'], ['Audit', 'Spot the errors in documents'],
  ['Case reflection', 'Free text, panel comparison'], ['Team event', 'Cohorts compete over days'], ['Care game', 'Daily check-ins, streaks'],
  ['Blank', 'The AI asks a few questions, then you design anything'],
];

// ---- Studio ----

export interface DraftQuestion {
  id: string;
  text: string;
  grounded: boolean;
  sourceDoc: string;
  sourceLoc: string;
  passage: string;
  options: string[];
}

export const DRAFT_QUESTIONS: Record<string, DraftQuestion> = {
  '1.1': { id: '1.1', text: 'Which supplies fall under the 21% standard rate by default?', grounded: true, sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Art. 37 § 1', passage: 'Unless a reduced rate applies, supplies of goods and services are subject to the standard rate of 21%.', options: ['All supplies unless listed in Table A or B', 'Only services', 'Only goods', 'Only imports'] },
  '1.2': { id: '1.2', text: 'Name the three VAT rates in force in Belgium.', grounded: true, sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Royal Decree 20 · Art. 1', passage: 'The rates are 6%, 12% and 21%.', options: ['6, 12, 21', '5, 10, 20', '6, 21', '0, 6, 21'] },
  '2.1': { id: '2.1', text: 'Renovation of a 12-year-old dwelling: which rate?', grounded: true, sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Royal Decree 20 · Table A · XXXVIII', passage: 'The reduced rate of 6% applies to work on immovable property for a private dwelling whose first occupation took place at least ten years before.', options: ['21%', '6%', '12%', '0%'] },
  '2.2': { id: '2.2', text: 'Detached garden shed on the same plot: 6% or 21%?', grounded: true, sourceDoc: 'Circular 2024/C/12', sourceLoc: 'Section 3.2', passage: 'Outbuildings not forming part of the existing dwelling remain subject to the standard rate.', options: ['6%', '21%', '12%', 'Exempt'] },
  '2.3': { id: '2.3', text: 'Does the residential letting exemption cover the renovation invoice?', grounded: true, sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Art. 44 § 3 2°', passage: 'The exemption does not extend to supplies received by the lessor.', options: ['Yes', 'No', 'Partly', 'Only for social housing'] },
  '3.1': { id: '3.1', text: 'Which rate applies to restaurant services excluding drinks?', grounded: true, sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Royal Decree 20 · Table B · I', passage: 'Restaurant and catering services, excluding the supply of beverages, are subject to the 12% rate.', options: ['6%', '12%', '21%', 'Exempt'] },
  '3.2': { id: '3.2', text: 'Rate for e-books since 2019?', grounded: false, sourceDoc: '', sourceLoc: '', passage: '', options: ['6%', '12%', '21%', 'Exempt'] },
  '4.1': { id: '4.1', text: 'Solar panels on a 5-year-old home: which rate applied in 2023 and why?', grounded: false, sourceDoc: '', sourceLoc: '', passage: '', options: ['6% temporary measure', '21%', '12%', 'Exempt'] },
};

export const LEVELS: { n: number; name: string; meta: string; items: string[] }[] = [
  { n: 1, name: 'Rates basics', meta: '6 questions · 60 s each', items: ['1.1', '1.2'] },
  { n: 2, name: 'Renovation works', meta: '6 questions · 90 s each', items: ['2.1', '2.2', '2.3'] },
  { n: 3, name: 'Reduced-rate edge cases', meta: '6 questions · 90 s each', items: ['3.1', '3.2'] },
  { n: 4, name: 'Mixed and exempt', meta: '6 questions · 120 s each · badge', items: ['4.1'] },
];

export interface FlowNodeDef {
  title: string;
  sub: string;
  kind: FlowNodeKind;
  left: number;
  top: number;
  state?: FlowNodeState;
  recent?: boolean;
}

export const FLOW_NODES: FlowNodeDef[] = [
  { title: 'Player profile', sub: 'grade · service line', kind: 'profile', left: 0, top: 20 },
  { title: 'Level 1 · Rates basics', sub: '6 questions · 60 s', kind: 'base', left: 220, top: 20 },
  { title: 'Level 2 · Renovation', sub: '6 questions · 90 s', kind: 'base', left: 460, top: 20, state: 'selected' },
  { title: 'Level 3 · Edge cases', sub: 'score ≥ 70%', kind: 'base', left: 700, top: 20, state: 'related' },
  { title: 'Retry level 2', sub: 'score < 70% · new set', kind: 'followup', left: 700, top: 112, recent: true },
  { title: 'Timed out', sub: 'resume tomorrow', kind: 'outcome', left: 460, top: 204 },
];

export const DOMAIN_DOCS = [
  { name: 'BE VAT Code 2026 · OKF bundle', kind: 'OKF', used: 14, cov: '78%', on: true },
  { name: 'Circular 2024/C/12 · OKF bundle', kind: 'OKF', used: 5, cov: '40%', on: true },
  { name: 'Invoice mandatory mentions.md', kind: 'Markdown', used: 3, cov: '55%', on: true },
  { name: 'Intra-community supplies guide.pdf', kind: 'PDF · 48 p', used: 0, cov: '0%', on: false },
];

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
}

export const INITIAL_CHAT: ChatMessage[] = [
  { role: 'user', text: 'Level 2 should test reduced rates on renovation works. Three questions, hardest last.' },
  { role: 'assistant', text: 'Drafted 3 questions for Level 2. Each links to a passage in the Belgian VAT domain; 2.3 covers the 10-year rule for the 6% renovation rate.', sources: ['BE VAT Code 2026', 'Circular 2024/C/12'] },
];

// ---- Workflow ----

export const STAGES = ['Draft', 'Dev', 'Test', 'Review', 'Published'];

/** One card per stage after Draft; card i+1 is current when `stage === i + 1`. */
export const STAGE_CARDS: { name: string; who: string; checks: [string, string, string][]; cta: string; secondary: string }[] = [
  { name: 'Dev', who: 'Sofie Claes', checks: [['#86BC25', '4 levels, 24 questions', ''], ['#e0a100', '2 ungrounded questions', '3.2, 4.1 · fix before test'], ['#86BC25', 'Content Domain linked', 'Belgian VAT · indexed 12 Oct']], cta: 'Send to test', secondary: 'Play as creator' },
  { name: 'Test', who: '3 testers invited', checks: [['#86BC25', 'Automated · grounding coverage 92%', 'target 90%'], ['#86BC25', 'Automated · 0 broken branches', 'retry path checked'], ['#a0a69d', 'Testers · 0 of 3 played', 'Omar Haddad, Marie Dubois, Jonas Wouters']], cta: 'Submit for review', secondary: 'Invite tester' },
  { name: 'Review', who: 'Reviewer · Pieter Maes', checks: [['#a0a69d', 'Technical accuracy sign-off', ''], ['#a0a69d', 'Tone and difficulty for Analysts', '']], cta: 'Approve and publish', secondary: 'Request changes' },
  { name: 'Publish', who: 'Allocates on publish', checks: [['#a0a69d', 'Version v4 replaces v3 for new starts', ''], ['#a0a69d', 'Reaches the cohorts and players on the right', '']], cta: 'Publish v4', secondary: 'Schedule' },
];

export const INITIAL_COHORTS: Record<Cohort, boolean> = { 'Analysts': true, 'Consultants': true, 'Seniors': false, 'Indirect tax': true, 'Brussels': false, 'Antwerp': false, 'New joiners 2026': true };

/** Individually allocated players (Lena Peeters, Omar Haddad) count on top of the cohorts. */
export const INDIVIDUAL_PLAYERS = ['Lena Peeters', 'Omar Haddad'];

// ---- Blank game brief ----

export type Feel = 'competitive' | 'reflective' | 'care' | 'story';
export type Platform = 'browser' | 'phone' | 'both';
export type Mechanic =
  | 'Leaderboard' | 'Timer' | 'Levels' | 'Badges and certificate' | 'Streaks' | 'Branching story'
  | 'Free-text answers, AI-scored' | 'Team play' | 'Feedback citing the source';
export type AudienceCohort = Extract<Cohort, 'Analysts' | 'Consultants' | 'Seniors' | 'New joiners 2026'>;

export interface Brief {
  goal: string;
  outcome: string;
  domain: DomainKey;
  feel: Feel;
  mechanics: Record<Mechanic, boolean>;
  audience: Record<AudienceCohort, boolean>;
  length: string;
  platform: Platform;
  ai: 'draft' | 'skeleton' | 'assist';
  difficulty: 'ramp' | 'flat' | 'adaptive';
  failure: 'retry' | 'move' | 'lose';
}

export const INITIAL_BRIEF: Brief = {
  goal: '', outcome: '', domain: 'vat', feel: 'competitive',
  mechanics: { 'Leaderboard': true, 'Timer': false, 'Levels': true, 'Badges and certificate': true, 'Streaks': false, 'Branching story': false, 'Free-text answers, AI-scored': false, 'Team play': false, 'Feedback citing the source': true },
  audience: { 'Analysts': true, 'Consultants': false, 'Seniors': false, 'New joiners 2026': true },
  length: '10 min', platform: 'browser', ai: 'draft', difficulty: 'ramp', failure: 'retry',
};

export const EXAMPLES: [string, string][] = [
  ['Magic: The Gathering', 'A collectible card game like Magic: The Gathering. Cards are VAT rules and exemptions; you cast them against an opponent’s transaction and win by taxing it correctly.'],
  ['Jeopardy', 'Jeopardy with a board of VAT categories and point values; answers must be phrased as the article of the Code.'],
  ['Four in a Row', 'Four in a Row. Each disc you drop requires a correct answer to a VAT question first; a wrong answer passes the turn.'],
  ['Chess with hints', 'A version of chess where, before you get a hint, you must answer a tax question correctly.'],
  ['Escape room', 'An escape room: the client’s file is locked and every clue is a passage from the Circular.'],
];

export const FEEL_SHAPE: Record<Feel, string> = {
  competitive: 'Scored run · points per item',
  reflective: 'Cases with written judgement · panel comparison, no score',
  care: 'Daily check-ins · a file that degrades if ignored',
  story: 'Branching dialogue · consequences, not points',
};

/** "Decide for me" picks one of these at random. */
export const IDEAS: { goal: string; feel: Feel; mech: Mechanic[]; platform: Platform; length: string }[] = [
  { goal: 'Keep a fictional client’s VAT position healthy for a quarter', feel: 'care', mech: ['Streaks', 'Badges and certificate', 'Feedback citing the source'], platform: 'phone', length: '2 min' },
  { goal: 'Talk a nervous importer through deferment without misquoting the Code', feel: 'story', mech: ['Branching story', 'Feedback citing the source'], platform: 'browser', length: '20 min' },
  { goal: 'Spot the wrong rate on twelve real-looking invoices before the client does', feel: 'competitive', mech: ['Timer', 'Leaderboard', 'Levels', 'Feedback citing the source'], platform: 'both', length: '10 min' },
  { goal: 'Form a defensible judgement on a triangulation chain and compare it with the panel', feel: 'reflective', mech: ['Free-text answers, AI-scored', 'Feedback citing the source'], platform: 'browser', length: '45 min' },
];
