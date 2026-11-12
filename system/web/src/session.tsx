import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, onUnauthorized } from "./api";
import type { Session } from "./types";

interface SessionCtx {
  session: Session | null;
  error: unknown;
  refresh: () => Promise<void>;
  /** True when the server is locked with an operator key (ADMIN_KEY) or an operator call returned 401. */
  locked: boolean;
}

const Ctx = createContext<SessionCtx>({ session: null, error: null, refresh: async () => {}, locked: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [forcedLock, setForcedLock] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      setSession(s);
      setError(null);
      setForcedLock(false);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onUnauthorized(() => setForcedLock(true));
  }, [refresh]);

  const locked = forcedLock || (!!session && session.auth_required && !session.authenticated);
  return <Ctx.Provider value={{ session, error, refresh, locked }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
