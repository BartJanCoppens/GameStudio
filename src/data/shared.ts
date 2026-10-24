export type Role = 'player' | 'creator' | 'gameadmin' | 'admin';
export type Screen =
  | 'library' | 'play' | 'results'
  | 'games' | 'studio'
  | 'console'
  | 'dashboard' | 'users' | 'roles' | 'ai' | 'rules' | 'content';

export const SCREENS: Screen[] = ['library', 'play', 'results', 'games', 'studio', 'console', 'dashboard', 'users', 'roles', 'ai', 'rules', 'content'];

export const ROLE_HOME: Record<Role, Screen> = { player: 'library', creator: 'games', gameadmin: 'console', admin: 'dashboard' };

/** The role whose navigation a screen belongs to (content is shared by creators and admins). */
export const SCREEN_ROLES: Record<Screen, Role[]> = {
  library: ['player'], play: ['player'], results: ['player'],
  games: ['creator'], studio: ['creator'],
  console: ['gameadmin'],
  dashboard: ['admin'], users: ['admin'], roles: ['admin'], ai: ['admin'], rules: ['admin'], content: ['creator', 'admin'],
};

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
  player: [['Your games', 'library'], ['Results', 'results']],
  creator: [['My games', 'games'], ['Studio', 'studio'], ['Content domains', 'content']],
  gameadmin: [['Games', 'console']],
  admin: [['Overview', 'dashboard'], ['Users', 'users'], ['Roles & permissions', 'roles'], ['AI services', 'ai'], ['House rules', 'rules'], ['Content', 'content']],
};

export const NAV_GROUP: Record<Role, string> = { player: 'Play', creator: 'Create', gameadmin: 'Administer games', admin: 'Platform' };

export const SCREEN_TITLES: Record<Screen, string> = {
  library: 'Player · Library', play: 'Player · In game', results: 'Player · Results', games: 'Creator · My games', studio: 'Creator · Studio',
  console: 'Game administration', dashboard: 'Admin · Overview', users: 'Admin · Users',
  roles: 'Admin · Roles', ai: 'Admin · AI services', rules: 'Admin · House rules', content: 'Content domains',
};

