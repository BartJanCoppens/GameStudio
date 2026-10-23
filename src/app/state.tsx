import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ROLE_HOME, type Role, type Screen } from '../data/shared';
import { INITIAL_BRIEF, INITIAL_CHAT, INITIAL_COHORTS } from '../data/creator';
import { AppContext, type AppApi, type AppState, type Patch } from './useApp';

const INITIAL_STATE: AppState = {
  role: 'player', screen: 'library', lang: 'EN', toast: null,
  qi: 0, picked: null, score: 0, correct: 0, libFilter: 'All', installOpen: null,
  aiMode: 'assist', studioView: 'structure', selQ: '1.1', draftText: '', chat: INITIAL_CHAT, studioGame: null, briefRound: 1, brief: INITIAL_BRIEF,
  stage: 1, cohorts: INITIAL_COHORTS,
  consoleTab: 'content', pending: 0,
  userFilter: 'All', domain: 'vat',
};

const ROLES: Role[] = ['player', 'creator', 'gameadmin', 'admin'];
const CREATOR_ENTRY_SCREENS: Screen[] = ['blank', 'studio', 'workflow'];

/** `?role=creator` opens a role's home; `?screen=blank|studio|workflow` opens that creator screen (the prototype's defaultRole / defaultScreen props). */
function initialState(): AppState {
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role') as Role | null;
  const screen = params.get('screen') as Screen | null;
  if (screen && CREATOR_ENTRY_SCREENS.includes(screen)) return { ...INITIAL_STATE, role: 'creator', screen };
  if (role && ROLES.includes(role)) return { ...INITIAL_STATE, role, screen: ROLE_HOME[role] };
  return INITIAL_STATE;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(initialState);
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
    setRole: role => set({ role, screen: ROLE_HOME[role], toast: null }),
    go: screen => set({ screen }),
    toast,
    toastProto: () => toast('Prototype: this opens a form here · changes are logged with your name and time'),
  }), [s, set, toast]);

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}
