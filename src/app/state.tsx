import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// Role here is an app view; the database's built-in role keys use the same four names.
import { ROLE_HOME, SCREEN_ROLES, SCREENS, type Role, type Screen } from '../data/shared';
import { AppContext, type AppApi, type AppState, type Patch } from './useApp';

const INITIAL_STATE: AppState = {
  role: 'player', screen: 'library', lang: 'EN', toast: null, gameKey: '',
  resultsRunId: null, studioChatOpen: true, consoleTab: 'players',
};

/** `#/console?game=key` → that screen, the first of the user's roles it belongs to, and the game; anything else → null. */
function fromHash(allowed: Role[]): Pick<AppState, 'role' | 'screen' | 'gameKey'> | null {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const screen = path as Screen;
  if (!SCREENS.includes(screen)) return null;
  const role = SCREEN_ROLES[screen].find(r => allowed.includes(r));
  const game = new URLSearchParams(query).get('game');
  return role ? { role, screen, gameKey: game && /^[a-z0-9][a-z0-9-]{2,59}$/.test(game) ? game : '' } : null;
}

/** Studio chats and unsaved AI changes belong to one game. */
const STUDIO_RESET: Partial<AppState> = { resultsRunId: null };

/** Opens on the screen in the URL when the user may see it, else on their first role's home. */
function initialState(allowed: Role[]): AppState {
  return { ...INITIAL_STATE, ...(fromHash(allowed) ?? { role: allowed[0], screen: ROLE_HOME[allowed[0]] }) };
}

/** `roles`: the app views the signed-in user may open, in display order; never empty. */
export function AppProvider({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const [s, setS] = useState<AppState>(() => initialState(roles));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The URL follows the screen (so back/forward and links work), and the screen follows the URL.
  const firstScreen = useRef(true);
  useEffect(() => {
    const target = `#/${s.screen}${s.gameKey ? `?game=${s.gameKey}` : ''}`;
    if (window.location.hash !== target) window.history[firstScreen.current ? 'replaceState' : 'pushState'](null, '', target);
    firstScreen.current = false;
  }, [s.screen, s.gameKey]);
  useEffect(() => {
    const onHash = () => {
      const next = fromHash(roles);
      if (next) setS(prev => ({ ...prev, ...next, ...(next.gameKey !== prev.gameKey ? STUDIO_RESET : null) }));
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
  }, [roles]);

  const set = useCallback((patch: Patch) => setS(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) })), []);

  const toast = useCallback((msg: string) => {
    set({ toast: msg });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ toast: null }), 2600);
  }, [set]);

  const api = useMemo<AppApi>(() => ({
    s,
    set,
    roles,
    setRole: role => { if (roles.includes(role)) set({ role, screen: ROLE_HOME[role], toast: null }); },
    go: screen => set({ screen }),
    openGame: (gameKey, screen) => set(prev => ({ ...(gameKey !== prev.gameKey ? STUDIO_RESET : null), gameKey, screen })),
    toast,
    toastProto: () => toast('Proof of concept: this opens a form here · changes are logged with your name and time'),
  }), [s, set, toast, roles]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
