import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [year, setYear] = useState(null);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const refresh = useCallback(async () => {
    if (!getToken()) { setLoading(false); return; }
    try {
      const [me, sch, yr] = await Promise.all([
        api.get('/auth/me'),
        api.get('/school'),
        api.get('/academic-years')
      ]);
      setUser(me.user);
      setSchool(sch);
      setYears(yr);
      setYear(yr.find(y => y.is_active) || yr[0] || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setToken(data.token);
    setUser(data.user);
    await refresh();
    return data.user;
  };

  const logout = () => { setToken(null); setUser(null); setSchool(null); window.location.href = '/login'; };

  const toast = (msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const value = { user, school, year, years, loading, login, logout, toast, refresh, setSchool };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() { return useContext(AppContext); }
