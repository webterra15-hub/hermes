const TOKEN_KEY = 'edumanager_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

async function request(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    if (!path.startsWith('/auth/login')) window.location.href = '/login';
    throw new Error('Session expirée');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p) => request(p, { method: 'DELETE' }),
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch('/api/school/logo', { method: 'POST', headers, body: fd }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Erreur upload');
      return d;
    });
  }
};

export function fmt(n, currency = '') {
  if (n == null || isNaN(n)) return '—';
  const s = Number(n).toLocaleString('fr-FR');
  return currency ? `${s} ${currency}` : s;
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d.includes('T') ? d : `${d}T00:00:00`);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const ROLE_LABELS = { admin: 'Administrateur', secretaire: 'Secrétaire', professeur: 'Professeur' };
