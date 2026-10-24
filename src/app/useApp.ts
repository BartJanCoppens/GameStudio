import { createContext, useContext } from 'react';
import type { Lang, Role, Screen } from '../data/shared';

/** UI state shared across screens, one field per piece of UI that remembers something. */
export interface AppState {
  role: Role;
  screen: Screen;
  lang: Lang;
  toast: string | null;
  /** The game the player, Studio and Console screens are on (games.key). */
  gameKey: string;
  // player
  /** The run the Results screen shows; null = the player's latest finished run. */
  resultsRunId: string | null;
  // creator
  studioChatOpen: boolean;
  /** The sidebar menu is open (else folded to a rail). */
  navOpen: boolean;
  // game admin
  consoleTab: 'access' | 'content' | 'players' | 'ai';
}

export type Patch = Partial<AppState> | ((s: AppState) => Partial<AppState>);

export interface AppApi {
  s: AppState;
  set: (patch: Patch) => void;
  /** The app views the signed-in user holds a role for. */
  roles: Role[];
  setRole: (role: Role) => void;
  go: (screen: Screen) => void;
  /** Switch to another game and open a screen. */
  openGame: (gameKey: string, screen: Screen) => void;
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
