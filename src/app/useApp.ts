import { createContext, useContext } from 'react';
import type { Cohort, Lang, Role, Screen } from '../data/shared';
import type { GameContent } from '../game/content';
import type { Flag, InvoiceAnswer } from '../game/scoring';

/** A run of Spot the invoice errors in progress in this browser. */
export interface ActiveRun {
  id: string;
  /** The live game as it was when the run started, so a publish mid-run changes nothing. */
  content: GameContent;
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

/** One turn of the Studio's AI chat. */
export interface StudioChatEntry {
  /** studio_chat_messages.id once saved. */
  id?: number;
  role: 'user' | 'assistant';
  text: string;
  /** Assistant turns: what the function answered with ('error' = the call failed). */
  status?: 'changes' | 'answer' | 'out_of_scope' | 'error';
  changes?: string[];
  skipped?: string[];
}

/** AI changes shown in the preview but not saved to the draft yet. */
export interface StudioPending {
  content: GameContent;
  /** Invoices the changes added or touched. */
  touched: number[];
  count: number;
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
  studioChatOpen: boolean;
  /** The saved chat on screen; null = a new chat that starts with the next message. */
  studioChatId: string | null;
  studioChat: StudioChatEntry[];
  studioPending: StudioPending | null;
  stage: number;
  cohorts: Record<Cohort, boolean>;
  // game admin
  consoleTab: 'invoices' | 'players' | 'results' | 'ai';
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
