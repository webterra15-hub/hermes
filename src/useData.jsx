import { useState, useEffect } from 'react';

export default function useData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetcher().then((d) => {
      if (mounted) { setData(d); setError(null); }
    }).catch((e) => {
      if (mounted) setError(e.message);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [...deps, reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  return { data, loading, error, reload, setData };
}

export function useLoad(fetcher, deps = []) {
  const { data, loading, error, reload } = useData(fetcher, deps);
  return { data, loading, error, reload };
}
