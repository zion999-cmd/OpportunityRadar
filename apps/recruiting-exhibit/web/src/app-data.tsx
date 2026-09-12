// Shared app data hook: loads the three read endpoints the
// magazine needs (situation, status, inbox) once at shell level
// and exposes a reload + lightweight toast channel. No global
// state library — one hook, prop drilling is avoided by a tiny
// context.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchInbox,
  fetchSituation,
  fetchStatus,
  type InboxEntry,
  type SituationResponse,
  type StatusResponse,
} from './api.js';

interface AppData {
  readonly situation: SituationResponse | null;
  readonly status: StatusResponse | null;
  readonly inbox: ReadonlyArray<InboxEntry>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly toast: string | null;
  reload(): Promise<void>;
  setSituation(next: SituationResponse): void;
  showToast(message: string): void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { readonly children: ReactNode }): JSX.Element {
  const [situation, setSituation] = useState<SituationResponse | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [inbox, setInbox] = useState<ReadonlyArray<InboxEntry>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sit, st, box] = await Promise.all([
      fetchSituation(),
      fetchStatus(),
      fetchInbox(),
    ]);
    setSituation(sit);
    setStatus(st);
    setInbox(box);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const value = useMemo<AppData>(
    () => ({
      situation,
      status,
      inbox,
      loading,
      error,
      toast,
      reload,
      setSituation,
      showToast,
    }),
    [situation, status, inbox, loading, error, toast, reload, showToast],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (ctx === null) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
