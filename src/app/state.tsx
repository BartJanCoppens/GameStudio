import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ROLE_HOME, type Role, type Screen } from '../data/shared';
// Role here is an app view; the database's built-in role keys use the same four names.
import { INITIAL_BRIEF, INITIAL_CHAT, INITIAL_COHORTS } from '../data/creator';
import { AppContext, type AppApi, type AppState, type Patch } from './useApp';

const INITIAL_STATE: AppState = {
  role: 'player', screen: 'library', lang: 'EN', toast: null,
  qi: 0, picked: null, score: 0, correct: 0, libFilter: 'All', installOpen: null,
  aiMode: 'assist', studioView: 'structure', selQ: '1.1', draftText: '', chat: INITIAL_CHAT, studioGame: null, briefRound: 1, brief: INITIAL_BRIEF,
  stage: 1, cohorts: INITIAL_COHORTS,
  consoleTab: 'content', pending: 0,
  domain: 'vat',
};

const CREATOR_ENTRY_SCREENS: Screen[] = ['blank', 'studio', 'workflow'];

/**
 * Opens on the first role the user holds. `?role=creator` opens another of their roles;
 * `?screen=blank|studio|workflow` opens that creator screen (the prototype's defaultRole / defaultScreen props).
 */
function initialState(allowed: Role[]): AppState {
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role') as Role | null;
  const screen = params.get('screen') as Screen | null;
  if (screen && CREATOR_ENTRY_SCREENS.includes(screen) && allowed.includes('creator')) return { ...INITIAL_STATE, role: 'creator', screen };
  const start = role && allowed.includes(role) ? role : allowed[0];
  return { ...INITIAL_STATE, role: start, screen: ROLE_HOME[start] };
}

/** `roles`: the app views the signed-in user may open, in display order; never empty. */
export function AppProvider({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const [s, setS] = useState<AppState>(() => initialState(roles));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

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
    toastProto: () => toast('Prototype: this opens a form here · changes are logged with your name and time'),
  }), [s, set, toast, roles]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
