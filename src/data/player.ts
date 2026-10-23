import type { Status } from '../ds';

export interface PlayQuestion {
  id: number;
  points: number;
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
  sourceDoc: string;
  sourceLoc: string;
  passage: string;
}

export const QUESTIONS: PlayQuestion[] = [
  {
    id: 1, points: 10,
    prompt: 'A contractor renovates a private home in Ghent that was first occupied 12 years ago. Which VAT rate applies to the works?',
    options: ['21% standard rate', '6% reduced rate', '12% intermediate rate', '0% – exempt'], answer: 1,
    explain: 'Renovation of a dwelling older than 10 years qualifies for the 6% rate.',
    sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Royal Decree 20 · Table A · XXXVIII § 1',
    passage: 'The reduced rate of 6% applies to work on immovable property for a private dwelling whose first occupation took place at least ten years before the first chargeable event.',
  },
  {
    id: 2, points: 10,
    prompt: 'The same contractor also installs a new garden shed on the plot. Can the 6% rate be extended to the shed?',
    options: ['Yes, it is part of the same renovation', 'No, new construction detached from the dwelling is at 21%', 'Yes, if invoiced on the same invoice', 'Only if the shed is under 20 m²'], answer: 1,
    explain: 'Detached new constructions are excluded from the reduced rate.',
    sourceDoc: 'Circular 2024/C/12', sourceLoc: 'Section 3.2 · exclusions',
    passage: 'Works that consist of the construction of a new building, including outbuildings not forming part of the existing dwelling, remain subject to the standard rate.',
  },
  {
    id: 3, points: 10,
    prompt: 'The client asks for a VAT-exempt invoice because the house will be rented out. What do you tell them?',
    options: ['Agree, residential letting is exempt', 'Decline: the exemption covers the letting, not the renovation works', 'Apply 12% as a compromise', 'Issue a reverse-charge invoice'], answer: 1,
    explain: 'The exemption applies to the rental supply, not to inputs such as renovation services.',
    sourceDoc: 'BE VAT Code 2026 · OKF', sourceLoc: 'Art. 44 § 3 2°',
    passage: 'The letting of immovable property is exempt; the exemption does not extend to supplies of goods or services received by the lessor.',
  },
];

export const MAX_SCORE = QUESTIONS.reduce((a, q) => a + q.points, 0);

/** Remaining time shown per question in the prototype; there is no live countdown. */
export const TIMER = ['07:42', '05:18', '03:05'];

export type LibFilter = 'All' | 'Assigned' | 'In progress' | 'Completed' | 'Browser' | 'Phone';
export const LIB_FILTERS: LibFilter[] = ['All', 'Assigned', 'In progress', 'Completed', 'Browser', 'Phone'];

export interface LibraryGame {
  type: string;
  title: string;
  blurb: string;
  meta: string;
  playStatus: Status;
  playLabel: string;
  btnLabel: string;
  btnVariant: 'primary' | 'secondary';
  domain: string;
  filter: Exclude<LibFilter, 'All' | 'Browser' | 'Phone'>;
  plat: 'both' | 'browser' | 'phone';
  installed?: boolean;
  /** The one game whose play-through is implemented. */
  playable?: boolean;
}

export const LIBRARY: LibraryGame[] = [
  { type: 'Quiz ladder', title: 'VAT rates ladder', blurb: 'Four timed levels on rates and exemptions. Earn the Rates badge.', meta: 'Level 2 of 4 · due 31 Oct · 12 min', playStatus: 'in-progress', playLabel: 'In progress', btnLabel: 'Continue', btnVariant: 'primary', domain: 'Belgian VAT', filter: 'In progress', plat: 'both', installed: false, playable: true },
  { type: 'Simulation', title: 'The Antwerp importer call', blurb: 'A client calls about import VAT deferment. Choose what you say; the call branches.', meta: '8 turns · untimed · no score, feedback per turn', playStatus: 'not-started', playLabel: 'Not started', btnLabel: 'Play', btnVariant: 'secondary', domain: 'Belgian VAT', filter: 'Assigned', plat: 'browser' },
  { type: 'Audit', title: 'Spot the invoice errors', blurb: 'Twelve invoices, seven mistakes against the mandatory mentions. Find them all.', meta: '12 invoices · 15 min · leaderboard · needs a large screen', playStatus: 'accepted', playLabel: 'Completed · 9/12', btnLabel: 'Replay', btnVariant: 'secondary', domain: 'Belgian VAT', filter: 'Completed', plat: 'browser' },
  { type: 'Reflection', title: 'Form a judgement: the triangulation case', blurb: 'Read the case, write your advice, compare with the senior panel. Not scored.', meta: 'Free text · 20 min · peer comparison', playStatus: 'not-started', playLabel: 'Not started', btnLabel: 'Open', btnVariant: 'secondary', domain: 'Belgian VAT', filter: 'Assigned', plat: 'browser' },
  { type: 'Team event', title: 'Q4 VAT sprint', blurb: 'Indirect tax Brussels vs Antwerp. One question a day on your phone, team total counts.', meta: 'Opens 3 Nov · 10 days · team leaderboard · 24 MB', playStatus: 'na', playLabel: 'Opens 3 Nov', btnLabel: 'Details', btnVariant: 'secondary', domain: 'Belgian VAT', filter: 'Assigned', plat: 'phone', installed: false },
  { type: 'Care game', title: 'Keep the VAT file alive', blurb: 'A client file that needs daily attention: returns, listings, deadlines. Miss one and it suffers.', meta: 'Daily · 2 min · streak badge · notifications · 31 MB', playStatus: 'accepted', playLabel: 'Day 14 streak', btnLabel: 'Open on phone', btnVariant: 'secondary', domain: 'Belgian VAT', filter: 'Completed', plat: 'phone', installed: true },
];

export const matchesLibFilter = (g: LibraryGame, f: LibFilter) =>
  f === 'All' || g.filter === f || (f === 'Browser' && g.plat !== 'phone') || (f === 'Phone' && g.plat !== 'browser');

/** Leaving the game (or starting it again) resets the run. */
export const RESET_RUN = { screen: 'library', qi: 0, picked: null, score: 0, correct: 0 } as const;
