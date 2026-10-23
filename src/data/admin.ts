import type { Status } from '../ds';

// ---- Game admin console ----

/** Questions "Generate 5 from Belgian VAT" adds as pending, in order. */
export const GENERATED_ADDITIONS: { text: string; source: string }[] = [
  { text: 'Rate for a hairdresser’s services?', source: 'RD 20 · Table A · XXXV' },
  { text: 'Bicycle repair: which rate applies?', source: 'RD 20 · Table A · XXXV' },
  { text: 'Social housing works: 6% or 12%?', source: 'RD 20 · Table B · X' },
  { text: 'Hotel accommodation rate?', source: 'RD 20 · Table A · XXX' },
  { text: 'Medicines: reduced rate conditions?', source: 'RD 20 · Table A · XVII' },
];

export interface PlayerRow {
  name: string;
  cohort: string;
  progress: string;
  score: number;
  st: Status;
  status: string;
}

export const PLAYER_ROWS: PlayerRow[] = [
  { name: 'Omar Haddad', cohort: 'Analyst · Brussels', progress: 'Level 4 of 4', score: 112, st: 'accepted', status: 'Completed' },
  { name: 'Marie Dubois', cohort: 'Analyst · Brussels', progress: 'Level 4 of 4', score: 104, st: 'accepted', status: 'Completed' },
  { name: 'Lena Peeters', cohort: 'Analyst · Indirect tax', progress: 'Level 2 of 4', score: 60, st: 'in-progress', status: 'In progress' },
  { name: 'Jonas Wouters', cohort: 'Consultant · Antwerp', progress: 'Level 3 of 4', score: 71, st: 'in-progress', status: 'In progress' },
  { name: 'Ines Vandamme', cohort: 'New joiner 2026', progress: 'Not started', score: 0, st: 'not-started', status: 'Not started' },
];

// ---- Platform admin ----

export const ACTIVITY = [
  { text: 'Sofie Claes moved “VAT rates ladder” v4 to Test', meta: '23 Oct · 09:41' },
  { text: 'Thomas Vermeulen added 5 questions to “VAT rates ladder” (live)', meta: '22 Oct · 17:02' },
  { text: 'An De Smet uploaded OKF bundle “Circular 2024/C/12” v2', meta: '22 Oct · 11:15 · 2 games marked “source changed”' },
  { text: 'Pieter Maes requested changes on “Form a judgement”', meta: '21 Oct · 16:30' },
  { text: '18 new joiners imported from HR · cohort “New joiners 2026”', meta: '20 Oct · 08:00' },
];
