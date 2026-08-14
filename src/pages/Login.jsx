import { useState } from 'react';
import { useApp } from '../context';

export default function Login() {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">E</div>
        <h1 className="login-title">edumanager</h1>
        <div className="login-sub">Plateforme de gestion scolaire</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label>Nom d'utilisateur</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        <div className="login-hint">Compte par défaut : <b>admin</b> / <b>admin123</b></div>
      </form>
    </div>
  );
}
