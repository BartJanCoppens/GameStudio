import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { disablePush } from '../game/push';
import { byRoleOrder, type ProfileRow, type RoleRow } from '../lib/db';
import { AuthContext, type AuthApi, type AuthState } from './useAuth';

async function loadAccount(session: Session): Promise<AuthState> {
  const uid = session.user.id;
  const [{ data: profile, error: profileError }, { data: assignments, error: rolesError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single<ProfileRow>(),
    supabase.from('user_roles').select('role_key, roles(*)').eq('user_id', uid).returns<{ role_key: string; roles: RoleRow }[]>(),
  ]);
  if (profileError || !profile) return { status: 'signed-out', notice: 'Your account has no profile yet. Ask a platform admin.' };
  if (rolesError) return { status: 'signed-out', notice: rolesError.message };
  if (profile.status !== 'active') return { status: 'signed-out', notice: 'This account is deactivated. Ask a platform admin to reactivate it.' };

  const roles = (assignments ?? []).map(a => a.roles).sort(byRoleOrder);
  if (!roles.length) return { status: 'signed-out', notice: 'Your account has no role yet. Ask a platform admin to give you one.' };

  const { data: grants } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .in('role_key', roles.map(r => r.key))
    .eq('level', 1);
  return { status: 'signed-in', session, profile, roles, permissions: new Set((grants ?? []).map(g => g.permission_key as string)) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  /** The user whose account is loaded, or being loaded. */
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Fires INITIAL_SESSION on subscribe, then on every sign-in, sign-out and token refresh.
    // Keep it synchronous: awaiting Supabase calls inside it can deadlock the client, so loading is deferred.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        loadedFor.current = null;
        // Keep a notice set when an account was refused (see below).
        setState(prev => (prev.status === 'signed-out' ? prev : { status: 'signed-out' }));
        return;
      }
      // A token refresh hands over a new session for the same user: keep the account, swap the session.
      if (loadedFor.current === session.user.id) {
        setState(prev => (prev.status === 'signed-in' ? { ...prev, session } : prev));
        return;
      }
      loadedFor.current = session.user.id;
      setTimeout(() => {
        loadAccount(session).then(next => {
          if (cancelled) return;
          setState(next);
          // An account that may not use the app is signed out again, with the reason on the login screen.
          if (next.status === 'signed-out') void supabase.auth.signOut();
        });
      }, 0);
    });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) setState(await loadAccount(data.session));
  }, []);

  const api = useMemo<AuthApi>(() => ({
    state,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return null;
      if (error.message.toLowerCase().includes('banned')) return 'This account is deactivated. Ask a platform admin to reactivate it.';
      if (error.code === 'invalid_credentials') return 'Email or password is not right.';
      return error.message;
    },
    signOut: async () => {
      // A shared device stops notifying the person who signs out (best effort; never blocks signing out).
      await disablePush().catch(() => null);
      await supabase.auth.signOut();
      loadedFor.current = null;
      setState({ status: 'signed-out' });
    },
    refresh,
  }), [state, refresh]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
