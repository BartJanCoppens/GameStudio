import { createContext, useContext } from 'react';
import type { Cohort, Lang, Role, Screen } from '../data/shared';
import type { Flag, InvoiceAnswer } from '../game/scoring';

/** A run of Spot the invoice errors in progress in this browser. */
export interface ActiveRun {
  id: string;
  /** Client clock, for the countdown; the database keeps the authoritative times. */
  startedAt: number;
  answers: InvoiceAnswer[];
  /** 0-based position in INVOICES. */
  index: number;
  /** Flags on the current invoice before it is submitted. */
  flags: Flag[];
  /** The field the player is choosing a rule for. */
  choosing: string | null;
  submitted: boolean;
}

/** UI state shared across screens, one field per piece of UI that remembers something. */
export interface AppState {
  role: Role;
  screen: Screen;
  lang: Lang;
  toast: string | null;
  // player
  run: ActiveRun | null;
  /** The run the Results screen shows; null = the player's latest finished run. */
  resultsRunId: string | null;
  // creator
  studioInvoice: number;
  studioView: 'key' | 'player';
  stage: number;
  cohorts: Record<Cohort, boolean>;
  // game admin
  consoleTab: 'invoices' | 'players' | 'results';
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
