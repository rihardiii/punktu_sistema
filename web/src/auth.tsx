import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api.ts';
import type { User } from './types.ts';

interface AuthCtx {
  user: User | null;
  /** True until the initial session check finishes — avoids a login flash. */
  loading: boolean;
  needsSetup: boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  completeSetup: (body: { name: string; username: string; pin: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [me, setup] = await Promise.all([api.me(), api.setupStatus()]);
      setUser(me.user);
      setNeedsSetup(setup.needsSetup);
    } catch {
      // Server unreachable — treat as logged out rather than crashing the app.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, pin: string) => {
    const { user: loggedIn } = await api.login(username, pin);
    setUser(loggedIn);
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const completeSetup = useCallback(async (body: { name: string; username: string; pin: string }) => {
    const { user: created } = await api.setup(body);
    setUser(created);
    setNeedsSetup(false);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, needsSetup, login, logout, completeSetup, refresh }),
    [user, loading, needsSetup, login, logout, completeSetup, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
