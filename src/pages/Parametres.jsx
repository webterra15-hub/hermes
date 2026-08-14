import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading, Field, Badge } from '../components';

export default function Parametres() {
  const { user, school, setSchool, toast, refresh } = useApp();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('etablissement');

  const [form, setForm] = useState({ name: '', type: 'primaire', address: '', phone: '', email: '', currency: '', motto: '' });
  const [logoPreview, setLogoPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const [users, setUsers] = useState([]);
  const [showUser, setShowUser] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', full_name: '', role: 'secretaire' });

  const [years, setYears] = useState([]);
  const [showYear, setShowYear] = useState(false);
  const [yearLabel, setYearLabel] = useState('');

  const [periods, setPeriods] = useState([]);
  const [showPeriod, setShowPeriod] = useState(false);
  const [periodName, setPeriodName] = useState('');

  useEffect(() => {
    if (school) setForm({
      name: school.name, type: school.type, address: school.address || '',
      phone: school.phone || '', email: school.email || '', currency: school.currency || 'FCFA', motto: school.motto || ''
    });
  }, [school]);

  const loadUsers = async () => { try { setUsers(await api.get('/users')); } catch {} };
  const loadYears = async () => { try { setYears(await api.get('/academic-years')); } catch {} };
  const loadPeriods = async () => { try { setPeriods(await api.get('/periods')); } catch {} };

  useEffect(() => { if (isAdmin) { loadUsers(); loadYears(); loadPeriods(); } }, [isAdmin]);

  const saveSchool = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.put('/school', form);
      setSchool(res);
      toast('Paramètres de l\'établissement enregistrés');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const uploadLogo = async (file) => {
    try {
      const res = await api.uploadLogo(file);
      setSchool(res);
      toast('Logo mis à jour');
    } catch (err) { toast(err.message, 'error'); }
  };

  const createUser = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password || !userForm.full_name) return toast('Champs requis', 'error');
    try {
      await api.post('/users', userForm);
      toast('Utilisateur créé');
      setUserForm({ username: '', password: '', full_name: '', role: 'secretaire' });
      setShowUser(false); loadUsers();
    } catch (err) { toast(err.message, 'error'); }
  };

  const toggleUser = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      loadUsers();
    } catch (err) { toast(err.message, 'error'); }
  };

  const createYear = async (e) => {
    e.preventDefault();
    if (!yearLabel) return;
    try {
      await api.post('/academic-years', { label: yearLabel, set_active: 1 });
      toast('Année scolaire créée et activée');
      setYearLabel(''); setShowYear(false); loadYears(); refresh();
    } catch (err) { toast(err.message, 'error'); }
  };

  const setActiveYear = async (id) => {
    try {
      await api.put(`/academic-years/${id}`, { set_active: 1 });
      toast('Année scolaire activée');
      loadYears(); refresh();
    } catch (err) { toast(err.message, 'error'); }
  };

  const createPeriod = async (e) => {
    e.preventDefault();
    if (!periodName) return;
    try {
      await api.post('/periods', { name: periodName, sort_order: periods.length });
      toast('Période créée');
      setPeriodName(''); setShowPeriod(false); loadPeriods();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="tabs">
        <button className={`tab ${tab === 'etablissement' ? 'active' : ''}`} onClick={() => setTab('etablissement')}>Établissement</button>
        {isAdmin && <button className={`tab ${tab === 'annees' ? 'active' : ''}`} onClick={() => setTab('annees')}>Années & périodes</button>}
        {isAdmin && <button className={`tab ${tab === 'utilisateurs' ? 'active' : ''}`} onClick={() => setTab('utilisateurs')}>Utilisateurs</button>}
      </div>

      {tab === 'etablissement' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Informations de l'établissement</div>
                <div className="card-sub">Ces informations apparaîtront sur tous les documents générés (reçus, factures, bulletins…)</div>
              </div>
            </div>
            <form onSubmit={saveSchool} className="card-pad">
              <Field label="Nom de l'établissement"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <div className="form-grid">
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="primaire">Primaire</option>
                    <option value="secondaire">Secondaire</option>
                    <option value="primaire et secondaire">Primaire et secondaire</option>
                  </select>
                </Field>
                <Field label="Devise"><input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="FCFA, EUR, USD…" /></Field>
                <Field label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <Field label="Téléphone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              </div>
              <Field label="Slogan (optionnel)"><input value={form.motto} onChange={(e) => setForm({ ...form, motto: e.target.value })} placeholder="Ex : Le savoir pour tous" /></Field>
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
            </form>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Logo de l'établissement</div>
                <div className="card-sub">Format PNG, JPG ou WebP — 2 Mo maximum</div>
              </div>
            </div>
            <div className="card-pad">
              <div className="row mb-2">
                {logoPreview ? (
                  <img src={logoPreview} alt="prévisualisation" style={{ maxHeight: 90, borderRadius: 10, border: '1px solid var(--line)' }} />
                ) : school?.logo_url ? (
                  <img src={school.logo_url} alt="logo actuel" style={{ maxHeight: 90, borderRadius: 10, border: '1px solid var(--line)' }} />
                ) : (
                  <div className="empty-state" style={{ padding: 24 }}>Aucun logo</div>
                )}
              </div>
              <input
                type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (!f) return;
                  setLogoPreview(URL.createObjectURL(f));
                  uploadLogo(f);
                }}
              />
              <div className="hint" style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Le logo s'affichera automatiquement sur les reçus, factures, bulletins et listes.</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'annees' && isAdmin && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header between">
              <div>
                <div className="card-title">Années scolaires</div>
                <div className="card-sub">Créez une nouvelle année pour la réinscription des anciens élèves</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowYear(true)}>+ Nouvelle année</button>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Année</th><th>Statut</th><th></th></tr></thead>
                <tbody>
                  {years.map(y => (
                    <tr key={y.id}>
                      <td style={{ fontWeight: 600 }}>{y.label}</td>
                      <td>{y.is_active ? <Badge kind="green">Année active</Badge> : <Badge kind="gray">Inactive</Badge>}</td>
                      <td className="actions">
                        {!y.is_active && <button className="btn btn-outline btn-sm" onClick={() => setActiveYear(y.id)}>Activer</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-pad" style={{ borderTop: '1px solid var(--line)', fontSize: 12.5, color: 'var(--muted)' }}>
              💡 Pour la réinscription : créez la nouvelle année scolaire, activez-la, puis inscrivez les anciens élèves dans l'onglet « Élèves & Inscriptions ».
            </div>
          </div>

          <div className="card">
            <div className="card-header between">
              <div>
                <div className="card-title">Périodes de notes</div>
                <div className="card-sub">Trimestres ou semestres pour les bulletins</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPeriod(true)}>+ Période</button>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Période</th><th></th></tr></thead>
                <tbody>
                  {periods.length === 0 && <tr><td colSpan={2} className="text-center muted">Aucune période — ajoutez par ex. « 1er trimestre »</td></tr>}
                  {periods.map(p => (
                    <tr key={p.id}><td style={{ fontWeight: 600 }}>{p.name}</td><td /></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'utilisateurs' && isAdmin && (
        <div className="card">
          <div className="card-header between">
            <div>
              <div className="card-title">Utilisateurs</div>
              <div className="card-sub">Administrateur, secrétaire ou professeur</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowUser(true)}>+ Utilisateur</button>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Statut</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td>{u.username}</td>
                    <td><Badge kind={u.role === 'admin' ? 'blue' : u.role === 'secretaire' ? 'green' : 'amber'}>{u.role === 'admin' ? 'Admin' : u.role === 'secretaire' ? 'Secrétaire' : 'Professeur'}</Badge></td>
                    <td>{u.active ? <Badge kind="green">Actif</Badge> : <Badge kind="red">Désactivé</Badge>}</td>
                    <td className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => toggleUser(u)}>{u.active ? 'Désactiver' : 'Activer'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showUser} onClose={() => setShowUser(false)} title="Nouvel utilisateur"
        footer={<button className="btn btn-primary" form="user-form" type="submit">Créer</button>}>
        <form id="user-form" onSubmit={createUser}>
          <Field label="Nom complet"><input value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} autoFocus required /></Field>
          <div className="form-grid">
            <Field label="Identifiant"><input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required /></Field>
            <Field label="Mot de passe"><input type="text" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required /></Field>
          </div>
          <Field label="Rôle">
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="secretaire">Secrétaire</option>
              <option value="professeur">Professeur</option>
              <option value="admin">Administrateur</option>
            </select>
          </Field>
        </form>
      </Modal>

      <Modal open={showYear} onClose={() => setShowYear(false)} title="Nouvelle année scolaire"
        footer={<button className="btn btn-primary" form="year-form" type="submit">Créer et activer</button>}>
        <form id="year-form" onSubmit={createYear}>
          <Field label="Libellé" hint="Ex : 2026-2027"><input value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} placeholder="2026-2027" autoFocus required /></Field>
        </form>
      </Modal>

      <Modal open={showPeriod} onClose={() => setShowPeriod(false)} title="Nouvelle période"
        footer={<button className="btn btn-primary" form="period-form" type="submit">Créer</button>}>
        <form id="period-form" onSubmit={createPeriod}>
          <Field label="Nom" hint="Ex : 1er trimestre, 2e trimestre…"><input value={periodName} onChange={(e) => setPeriodName(e.target.value)} placeholder="1er trimestre" autoFocus required /></Field>
        </form>
      </Modal>
    </div>
  );
}
