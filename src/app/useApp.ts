import { createContext, useContext } from 'react';
import type { Cohort, DomainKey, Lang, Role, Screen } from '../data/shared';
import type { Brief, ChatMessage, StudioGame } from '../data/creator';
import type { LibFilter } from '../data/player';

/** The prototype's single component state, one field per piece of UI that remembers something. */
export interface AppState {
  role: Role;
  screen: Screen;
  lang: Lang;
  toast: string | null;
  // player
  qi: number;
  picked: number | null;
  score: number;
  correct: number;
  libFilter: LibFilter;
  installOpen: string | null;
  // creator
  aiMode: 'draft' | 'assist';
  studioView: 'structure' | 'canvas' | 'preview';
  selQ: string;
  draftText: string;
  chat: ChatMessage[];
  studioGame: StudioGame | null;
  briefRound: 1 | 2;
  brief: Brief;
  stage: number;
  cohorts: Record<Cohort, boolean>;
  // game admin
  consoleTab: 'content' | 'players' | 'results';
  pending: number;
  // admin
  domain: DomainKey;
}

export type Patch = Partial<AppState> | ((s: AppState) => Partial<AppState>);

export interface AppApi {
  s: AppState;
  set: (patch: Patch) => void;
  /** The app views the signed-in user holds a role for. */
  roles: Role[];
  setRole: (role: Role) => void;
  go: (screen: Screen) => void;
  toast: (msg: string) => void;
  /** Dead ends say so: the prototype's standard "this opens a form here" toast. */
  toastProto: () => void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
