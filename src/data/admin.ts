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

export type PlatformRole = 'Platform admin' | 'Game creator' | 'Game administrator' | 'Player';
export type UserFilter = 'All' | PlatformRole;
export const USER_FILTERS: UserFilter[] = ['All', 'Platform admin', 'Game creator', 'Game administrator', 'Player'];

export interface User {
  name: string;
  email: string;
  roles: PlatformRole[];
  cohort: string;
  last: string;
  st: Status;
  status: string;
}

export const USERS: User[] = [
  { name: 'An De Smet', email: 'adesmet@meridian.be', roles: ['Platform admin'], cohort: 'Partner · Brussels', last: '23 Oct', st: 'accepted', status: 'Active' },
  { name: 'Sofie Claes', email: 'sclaes@meridian.be', roles: ['Game creator', 'Player'], cohort: 'Senior manager · Indirect tax', last: '23 Oct', st: 'accepted', status: 'Active' },
  { name: 'Thomas Vermeulen', email: 'tvermeulen@meridian.be', roles: ['Game administrator', 'Player'], cohort: 'Manager · Indirect tax', last: '22 Oct', st: 'accepted', status: 'Active' },
  { name: 'Pieter Maes', email: 'pmaes@meridian.be', roles: ['Game creator'], cohort: 'Director · Indirect tax', last: '21 Oct', st: 'accepted', status: 'Active' },
  { name: 'Lena Peeters', email: 'lpeeters@meridian.be', roles: ['Player'], cohort: 'Analyst · Indirect tax · Brussels', last: '23 Oct', st: 'accepted', status: 'Active' },
  { name: 'Omar Haddad', email: 'ohaddad@meridian.be', roles: ['Player'], cohort: 'Analyst · Brussels', last: '22 Oct', st: 'accepted', status: 'Active' },
  { name: 'Ines Vandamme', email: 'ivandamme@meridian.be', roles: ['Player'], cohort: 'New joiner 2026 · Antwerp', last: '—', st: 'submitted', status: 'Invited' },
  { name: 'Jonas Wouters', email: 'jwouters@meridian.be', roles: ['Player'], cohort: 'Consultant · Antwerp', last: '19 Oct', st: 'accepted', status: 'Active' },
  { name: 'Karel Janssens', email: 'kjanssens@meridian.be', roles: ['Player'], cohort: 'Senior · Brussels', last: '2 Sep', st: 'not-started', status: 'Deactivated' },
];

export const ROLE_CARDS = [
  { name: 'Platform admin', short: 'Admin', count: 4, desc: 'Runs the platform: users, roles, content domains, every game.' },
  { name: 'Game creator', short: 'Creator', count: 9, desc: 'Designs games in the Studio, grounds them in a domain, moves them through the workflow.' },
  { name: 'Game administrator', short: 'Game admin', count: 5, desc: 'Per game: adds content, manages players and cohorts, publishes additions without the workflow.' },
  { name: 'Player', short: 'Player', count: 196, desc: 'Plays allocated games, earns badges and certificates.' },
];

/** 1 = granted, 2 = partial, 0 = not granted; columns follow ROLE_CARDS. */
export const PERMISSIONS: [string, string, (0 | 1 | 2)[]][] = [
  ['Manage users and invitations', 'Platform', [1, 0, 0, 0]],
  ['Edit roles and permissions', 'Platform', [1, 0, 0, 0]],
  ['Create and index Content Domains', 'Content', [1, 0, 0, 0]],
  ['Upload OKF bundles and documents', 'Content', [1, 1, 0, 0]],
  ['Create a game in the Studio', 'Games', [1, 1, 0, 0]],
  ['Move a game Dev → Test → Review', 'Workflow', [1, 1, 0, 0]],
  ['Approve and publish a version', 'Workflow', [1, 2, 0, 0]],
  ['Allocate to cohorts and players', 'Workflow', [1, 1, 1, 0]],
  ['Add content to a live game, no workflow', 'Game admin', [1, 0, 1, 0]],
  ['View results and leaderboards', 'Game admin', [1, 1, 1, 2]],
  ['Play allocated games', 'Play', [1, 1, 1, 1]],
];
