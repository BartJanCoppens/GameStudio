import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProfileRow, RoleRow } from '../lib/db';

export interface SignedIn {
  status: 'signed-in';
  session: Session;
  profile: ProfileRow;
  /** The user's roles, in display order. */
  roles: RoleRow[];
  /** Permission keys granted (level 1) by any of the user's roles. */
  permissions: Set<string>;
}

export type AuthState = { status: 'loading' } | { status: 'signed-out'; notice?: string } | SignedIn;

export interface AuthApi {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Re-reads the signed-in user's profile, roles and permissions (after an admin edits them). */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For components that only render once someone is signed in. */
export function useSignedIn(): SignedIn {
  const { state } = useAuth();
  if (state.status !== 'signed-in') throw new Error('useSignedIn needs a signed-in user');
  return state;
}
