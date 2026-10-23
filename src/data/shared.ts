import type { Status } from '../ds';

export type Role = 'player' | 'creator' | 'gameadmin' | 'admin';
export type Screen =
  | 'library' | 'play' | 'results'
  | 'games' | 'blank' | 'studio' | 'workflow'
  | 'console'
  | 'dashboard' | 'users' | 'roles' | 'content';

export const ROLE_HOME: Record<Role, Screen> = { player: 'library', creator: 'games', gameadmin: 'console', admin: 'dashboard' };

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'player', label: 'Player' },
  { value: 'creator', label: 'Game creator' },
  { value: 'gameadmin', label: 'Game admin' },
  { value: 'admin', label: 'Platform admin' },
];

export type Lang = 'NL' | 'FR' | 'EN';
export const LANG_OPTIONS: { value: Lang; label: string }[] = [{ value: 'NL', label: 'NL' }, { value: 'FR', label: 'FR' }, { value: 'EN', label: 'EN' }];

/** [label, screen, count] per role. */
export const NAV: Record<Role, [string, Screen, string?][]> = {
  player: [['Your games', 'library', '4'], ['Badges and results', 'results']],
  creator: [['My games', 'games', '6'], ['New game', 'blank'], ['Studio', 'studio'], ['Workflow & allocation', 'workflow'], ['Content domains', 'content']],
  gameadmin: [['VAT rates ladder', 'console']],
  admin: [['Overview', 'dashboard'], ['Users', 'users'], ['Roles & permissions', 'roles'], ['Content', 'content', '3'], ['Games', 'dashboard', '6']],
};

export const NAV_GROUP: Record<Role, string> = { player: 'Play', creator: 'Create', gameadmin: 'Administer games', admin: 'Platform' };

export const SCREEN_TITLES: Record<Screen, string> = {
  library: 'Player · Library', play: 'Player · In game', results: 'Player · Results', games: 'Creator · My games', studio: 'Creator · Studio',
  workflow: 'Creator · Workflow', blank: 'Creator · New game', console: 'Game administration', dashboard: 'Admin · Overview', users: 'Admin · Users',
  roles: 'Admin · Roles', content: 'Admin · Content',
};

export type Cohort = 'Analysts' | 'Consultants' | 'Seniors' | 'Indirect tax' | 'Brussels' | 'Antwerp' | 'New joiners 2026';
export const COHORT_SIZES: Record<Cohort, number> = { 'Analysts': 48, 'Consultants': 36, 'Seniors': 22, 'Indirect tax': 40, 'Brussels': 90, 'Antwerp': 60, 'New joiners 2026': 18 };

export interface DomainFile {
  name: string;
  version: string;
  items: string;
  st: Status;
  status: string;
  used: string;
}

export interface Domain {
  name: string;
  desc: string;
  status: Status;
  statusLabel: string;
  dot: string;
  meta: string;
  games: string;
  bundleCount: number;
  docCount: number;
  bundles: DomainFile[];
  docs: DomainFile[];
}

export type DomainKey = 'vat' | 'cit' | 'tp';

export const DOMAINS: Record<DomainKey, Domain> = {
  vat: {
    name: 'Belgian VAT', desc: 'VAT Code, royal decrees, circulars and practice notes · EN/NL/FR', status: 'accepted', statusLabel: 'Indexed 12 Oct', dot: '#86BC25',
    meta: '2 OKF bundles · 2 documents · 6 games', games: '6 games', bundleCount: 2, docCount: 2,
    bundles: [
      { name: 'BE VAT Code 2026', version: 'v3', items: '1,214 articles · 3 languages', st: 'accepted', status: 'Indexed', used: '5 games' },
      { name: 'Circular 2024/C/12', version: 'v2', items: '38 sections', st: 'accepted', status: 'Indexed', used: '2 games' },
    ],
    docs: [
      { name: 'Invoice mandatory mentions.md', version: 'Markdown', items: '6 pages', st: 'accepted', status: 'Indexed', used: '2 games' },
      { name: 'Intra-community supplies guide.pdf', version: 'PDF', items: '48 pages', st: 'in-progress', status: 'Indexing', used: '—' },
    ],
  },
  cit: {
    name: 'Corporate income tax', desc: 'Income Tax Code 1992 and related decrees', status: 'accepted', statusLabel: 'Indexed 2 Oct', dot: '#86BC25',
    meta: '1 OKF bundle · 4 documents · 0 games', games: '0 games', bundleCount: 1, docCount: 1,
    bundles: [{ name: 'ITC 1992 consolidated', version: 'v1', items: '2,041 articles', st: 'accepted', status: 'Indexed', used: '—' }],
    docs: [{ name: 'Innovation income deduction FAQ.pdf', version: 'PDF', items: '22 pages', st: 'accepted', status: 'Indexed', used: '—' }],
  },
  tp: {
    name: 'Transfer pricing', desc: 'OECD guidelines and Belgian circular 2020/C/35', status: 'in-progress', statusLabel: 'Indexing', dot: '#e0a100',
    meta: '1 OKF bundle · indexing · 0 games', games: '0 games', bundleCount: 1, docCount: 0,
    bundles: [{ name: 'OECD TP Guidelines 2022', version: 'v1', items: '658 pages', st: 'in-progress', status: 'Indexing · 64%', used: '—' }],
    docs: [],
  },
};

export const DOMAIN_SHORT_META: Record<DomainKey, string> = { vat: '2 OKF bundles · 2 documents', cit: '1 OKF bundle · 1 document', tp: '1 OKF bundle · indexing' };

export interface LeaderboardRow {
  rank: number;
  name: string;
  cohort: string;
  pts: number;
}

/** Lena's row moves with the score of the run in progress. */
export const leaderboard = (score: number): LeaderboardRow[] => [
  { rank: 1, name: 'Omar Haddad', cohort: 'Analyst · Brussels', pts: 112 },
  { rank: 2, name: 'Marie Dubois', cohort: 'Analyst · Brussels', pts: 104 },
  { rank: 3, name: 'Lena Peeters', cohort: 'Analyst · Brussels', pts: 60 + score },
  { rank: 4, name: 'Jonas Wouters', cohort: 'Analyst · Antwerp', pts: 71 },
  { rank: 5, name: 'Ines Vandamme', cohort: 'Analyst · Brussels', pts: 66 },
];
