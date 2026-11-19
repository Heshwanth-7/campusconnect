import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { authAction, getCurrentUser } from '../api/auth';
import type { User } from '../api/auth';
import { ApiError, onSessionLost } from '../api/client';

type Session =
  | { status: 'loading' | 'anonymous' | 'unavailable'; user: null }
  | { status: 'authenticated'; user: User };

type Auth = Session & {
  reload: () => Promise<void>;
  signIn: (credentials: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading', user: null });
  const pending = useRef<Promise<void> | null>(null);

  const reload = useCallback(() => {
    if (pending.current) return pending.current;
    setSession({ status: 'loading', user: null });
    pending.current = getCurrentUser()
      .then((user) => setSession({ status: 'authenticated', user }))
      .catch((error: unknown) => {
        const rejected = error instanceof ApiError && (error.status === 401 || error.status === 403);
        setSession({ status: rejected ? 'anonymous' : 'unavailable', user: null });
      })
      .finally(() => { pending.current = null; });
    return pending.current;
  }, []);

  useEffect(() => {
    const unsubscribe = onSessionLost(() => setSession({ status: 'anonymous', user: null }));
    void reload();
    return unsubscribe;
  }, [reload]);

  async function signIn(credentials: { email: string; password: string }) {
    // Let the initial /me check finish before creating a new session.
    await pending.current;
    await authAction('login', credentials);
    try {
      const user = await getCurrentUser();
      setSession({ status: 'authenticated', user });
    } catch {
      throw new Error('We could not load your account. Try signing in again.');
    }
  }

  async function signOut() {
    await authAction('logout');
    setSession({ status: 'anonymous', user: null });
  }

  return (
    <AuthContext.Provider value={{ ...session, reload, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider is missing.');
  return auth;
}
