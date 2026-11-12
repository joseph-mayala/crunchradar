import { useCallback, useEffect, useRef, useState } from "react";

export interface DataState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (v: T) => void;
}

/** Tiny fetch hook: runs `load` on mount and when `deps` change; `reload` re-runs it. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    loadRef
      .current()
      .then((d) => live && setData(d))
      .catch((e: unknown) => live && setError(e))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
