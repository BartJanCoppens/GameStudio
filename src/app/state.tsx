import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// Role here is an app view; the database's built-in role keys use the same four names.
import { ROLE_HOME, SCREEN_ROLES, SCREENS, type Role, type Screen } from '../data/shared';
import { INITIAL_COHORTS } from '../data/creator';
import { AppContext, type AppApi, type AppState, type Patch } from './useApp';

const INITIAL_STATE: AppState = {
  role: 'player', screen: 'library', lang: 'EN', toast: null,
  run: null, resultsRunId: null,
  studioInvoice: 1, studioView: 'key', stage: 1, cohorts: INITIAL_COHORTS,
  consoleTab: 'invoices',
};

/** `#/console` → that screen and the first of the user's roles it belongs to; anything else → null. */
function fromHash(allowed: Role[]): Pick<AppState, 'role' | 'screen'> | null {
  const screen = window.location.hash.replace(/^#\/?/, '') as Screen;
  if (!SCREENS.includes(screen)) return null;
  const role = SCREEN_ROLES[screen].find(r => allowed.includes(r));
  return role ? { role, screen } : null;
}

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
    const target = `#/${s.screen}`;
    if (window.location.hash !== target) window.history[firstScreen.current ? 'replaceState' : 'pushState'](null, '', target);
    firstScreen.current = false;
  }, [s.screen]);
  useEffect(() => {
    const onHash = () => { const next = fromHash(roles); if (next) setS(prev => ({ ...prev, ...next })); };
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
    toast,
    toastProto: () => toast('Proof of concept: this opens a form here · changes are logged with your name and time'),
  }), [s, set, toast, roles]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
