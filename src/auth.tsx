import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Profile, Role } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: Role) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('user already registered')) return 'An account with this email already exists.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (m.includes('unable to validate email address')) return 'Please enter a valid email address.';
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
  });

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile:', error.message);
      return null;
    }
    return data as Profile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (state.user) {
      const profile = await loadProfile(state.user.id);
      setState((s) => ({ ...s, profile }));
    }
  }, [state.user, loadProfile]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const session = data.session;
      let profile: Profile | null = null;
      if (session?.user) {
        // The profile row is created by a DB trigger on signup. On a brand-new
        // signup the row may not be visible instantly, so retry briefly.
        for (let attempt = 0; attempt < 5; attempt++) {
          profile = await loadProfile(session.user.id);
          if (profile) break;
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      if (!active) return;
      setState({ session, user: session?.user ?? null, profile, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        let profile: Profile | null = null;
        if (session?.user) {
          for (let attempt = 0; attempt < 5; attempt++) {
            profile = await loadProfile(session.user.id);
            if (profile) break;
            await new Promise((r) => setTimeout(r, 300));
          }
        }
        if (!active) return;
        setState({ session, user: session?.user ?? null, profile, loading: false });
      })();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? formatAuthError(error.message) : null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, role: Role) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });
      if (error) return { error: formatAuthError(error.message) };
      // signUp returns a session immediately when email confirmation is off.
      // Eagerly fetch the profile so the UI can route without waiting for the
      // onAuthStateChange callback.
      if (data.user) {
        let profile: Profile | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          profile = await loadProfile(data.user.id);
          if (profile) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        if (profile) {
          setState((s) => ({
            ...s,
            session: data.session,
            user: data.user,
            profile,
            loading: false,
          }));
        }
      }
      return { error: null };
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({ session: null, user: null, profile: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
