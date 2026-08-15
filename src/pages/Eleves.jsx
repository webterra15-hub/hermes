import { useEffect, useState } from 'react';
import { api, fmt } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading, Field, Badge, Confirm } from '../components';

const EMPTY = {
  first_name: '', last_name: '', gender: 'M', birth_date: '', birth_place: '',
  parent_name: '', parent_phone: '', parent_email: '', address: ''
};

export default function Eleves() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const canWrite = ['admin', 'secretaire'].includes(user?.role);

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showReenroll, setShowReenroll] = useState(false);
  const [tab, setTab] = useState('inscrits');

  const [form, setForm] = useState(EMPTY);
  const [formClass, setFormClass] = useState('');
  const [isReenroll, setIsReenroll] = useState(false);
  const [reenrollTarget, setReenrollTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [st, cl] = await Promise.all([
        api.get(`/students?class_id=${classFilter || ''}`),
        api.get('/classes')
      ]);
      setStudents(st); setClasses(cl);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [classFilter]);

  const filtered = search
    ? students.filter(s => `${s.first_name} ${s.last_name} ${s.parent_name}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) return toast('Nom et prénom requis', 'error');
    setBusy(true);
    try {
      if (reenrollTarget) {
        if (!formClass) return toast('Choisir une classe', 'error');
        await api.post(`/students/${reenrollTarget.id}/enroll`, { class_id: formClass, is_reenrollment: 1 });
        toast('Ancien élève réinscrit');
        setReenrollTarget(null);
      } else {
        const body = { ...form };
        if (formClass) body.class_id = formClass;
        body.is_reenrollment = isReenroll ? 1 : 0;
        await api.post('/students', body);
        toast(isReenroll ? 'Ancien élève réinscrit' : 'Élève inscrit');
      }
      setForm(EMPTY); setFormClass(''); setIsReenroll(false);
      setShowReenroll(false); load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/students/${editing.id}`, form);
      toast('Dossier mis à jour');
      setEditing(null); setForm(EMPTY); load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      first_name: s.first_name, last_name: s.last_name, gender: s.gender,
      birth_date: s.birth_date || '', birth_place: s.birth_place || '',
      parent_name: s.parent_name || '', parent_phone: s.parent_phone || '',
      parent_email: s.parent_email || '', address: s.address || ''
    });
  };

  const changeClass = async (s, newClassId) => {
    try {
      await api.post(`/students/${s.id}/enroll`, { class_id: newClassId, is_reenrollment: 0 });
      toast('Classe modifiée');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const doArchive = async () => {
    setBusy(true);
    try {
      await api.post(`/students/${confirmTarget.id}/archive`, { archived: !confirmArchive });
      toast(confirmArchive ? 'Élève restauré' : 'Élève archivé');
      setConfirmTarget(null); load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.del(`/students/${confirmTarget.id}`);
      toast('Élève supprimé');
      setConfirmTarget(null); load();
    } catch (err) {
      if (err.message.includes('409') || (confirmTarget && err.message.includes('archiv'))) {
        toast('Cet élève a des données liées — archivez-le à la place.', 'error');
      } else toast(err.message, 'error');
    } finally { setBusy(false); }
  };

  const activeCount = students.filter(s => s.enrollment_id).length;
  const formerCount = students.filter(s => !s.enrollment_id).length;

  return (
    <div>
      <div className="between mb-3">
        <div className="row">
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {canWrite && (
            <>
              <button className="btn btn-outline" onClick={() => { setReenrollTarget(null); setIsReenroll(true); setShowReenroll(true); }}>↩ Réinscrire un ancien élève</button>
              <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setIsReenroll(false); setShowReenroll(true); }}>+ Nouvel élève</button>
            </>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'inscrits' ? 'active' : ''}`} onClick={() => setTab('inscrits')}>Inscrits cette année ({activeCount})</button>
        <button className={`tab ${tab === 'anciens' ? 'active' : ''}`} onClick={() => setTab('anciens')}>Anciens élèves non inscrits ({formerCount})</button>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="search-input" placeholder="Rechercher un élève ou un parent…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Élève</th><th>Sexe</th>{tab === 'inscrits' && <th>Classe</th>}<th>Parent / Tuteur</th><th>Téléphone</th>
                {tab === 'inscrits' && <th className="num">Payé</th>}<th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8}><Loading /></td></tr>}
              {!loading && filtered.filter(s => (tab === 'inscrits') === !!s.enrollment_id).length === 0 &&
                <tr><td colSpan={8}><Empty message={tab === 'inscrits' ? 'Aucun élève inscrit' : 'Aucun ancien élève — les anciens élèves de l\'année précédente apparaîtront ici pour la réinscription'} /></td></tr>}
              {filtered.filter(s => (tab === 'inscrits') === !!s.enrollment_id).map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>
                    {s.first_name} {s.last_name}
                    {s.is_reenrollment ? ' ' : ''}
                    {s.is_reenrollment === 1 && <Badge kind="blue">Réinscrit</Badge>}
                  </td>
                  <td>{s.gender === 'F' ? 'F' : 'M'}</td>
                  {tab === 'inscrits' && (
                    <td>
                      {canWrite ? (
                        <select value={s.class_id || ''} onChange={(e) => changeClass(s, e.target.value)} style={{ padding: '5px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12.5 }}>
                          <option value="">—</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (s.class_name || '—')}
                    </td>
                  )}
                  <td>{s.parent_name || '—'}</td>
                  <td>{s.parent_phone || '—'}</td>
                  {tab === 'inscrits' && <td className="num">{fmt(s.paid || 0, curr)}</td>}
                  <td className="actions">
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>Dossier</button>
                    {canWrite && tab === 'inscrits' && (
                      <>
                        <button className="btn btn-outline btn-sm" onClick={() => { setConfirmTarget(s); setConfirmArchive(s.archived ? false : true); }}>{s.archived ? 'Restaurer' : 'Archiver'}</button>
                        <button className="btn btn-danger-outline btn-sm" onClick={() => { setConfirmTarget(s); setConfirmArchive(null); }}>Supprimer</button>
                      </>
                    )}
                    {tab === 'anciens' && canWrite && (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setForm({ ...EMPTY, first_name: s.first_name, last_name: s.last_name, parent_name: s.parent_name }); setFormClass(''); setReenrollTarget(s); setIsReenroll(true); setShowReenroll(true); }}>Réinscrire</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showReenroll}
        onClose={() => { setShowReenroll(false); setIsReenroll(false); setReenrollTarget(null); }}
        title={isReenroll ? 'Réinscription d\'un ancien élève' : 'Inscription d\'un nouvel élève'}
        footer={<button className="btn btn-primary" form="student-form" type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Inscrire'}</button>}
      >
        <div className="alert" style={{ background: isReenroll ? 'var(--secondary-light)' : 'var(--primary-light)', border: 'none', color: isReenroll ? 'var(--secondary)' : 'var(--primary-dark)' }}>
          {isReenroll
            ? (reenrollTarget
                ? `Réinscription de ${reenrollTarget.first_name} ${reenrollTarget.last_name} : choisissez sa nouvelle classe.`
                : 'L\'élève sera rattaché à cette nouvelle année scolaire, en conservant son dossier (fiche, parents, paiements précédents).')
            : 'Remplissez la fiche de l\'élève puis choisissez sa classe.'}
        </div>
        {!reenrollTarget && (
        <form id="student-form" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Prénom"><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></Field>
            <Field label="Nom"><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></Field>
            <Field label="Sexe">
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="M">Masculin</option><option value="F">Féminin</option>
              </select>
            </Field>
            <Field label="Date de naissance"><input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></Field>
            <Field label="Lieu de naissance"><input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} /></Field>
            <Field label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
          <div className="card card-pad dashed-border mb-2" style={{ boxShadow: 'none', marginTop: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Parent / Tuteur</div>
            <div className="form-grid">
              <Field label="Nom complet"><input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></Field>
              <Field label="Téléphone"><input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></Field>
              <Field label="Email"><input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} /></Field>
            </div>
          </div>
          <Field label="Classe d'affectation" hint={isReenroll ? 'La scolarité de la classe sélectionnée sera appliquée' : undefined}>
            <select value={formClass} onChange={(e) => setFormClass(e.target.value)} required>
              <option value="">— Choisir une classe —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {fmt(c.tuition_fee, curr)}/an</option>)}
            </select>
          </Field>
        </form>
        )}
        {reenrollTarget && (
          <form id="student-form" onSubmit={submit}>
            <div className="card card-pad dashed-border mb-2" style={{ boxShadow: 'none' }}>
              <div style={{ fontWeight: 700 }}>{reenrollTarget.first_name} {reenrollTarget.last_name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{reenrollTarget.parent_name ? `Parent : ${reenrollTarget.parent_name}` : ''}</div>
            </div>
            <Field label="Nouvelle classe" hint="La scolarité de la classe sélectionnée sera appliquée">
              <select value={formClass} onChange={(e) => setFormClass(e.target.value)} required>
                <option value="">— Choisir une classe —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} · {fmt(c.tuition_fee, curr)}/an</option>)}
              </select>
            </Field>
          </form>
        )}
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setForm(EMPTY); }}
        title={`Dossier — ${editing ? `${editing.first_name} ${editing.last_name}` : ''}`}
        footer={<button className="btn btn-primary" form="edit-form" type="submit" disabled={busy}>Enregistrer</button>}
      >
        {editing && (
          <form id="edit-form" onSubmit={saveEdit}>
            <div className="form-grid">
              <Field label="Prénom"><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></Field>
              <Field label="Nom"><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></Field>
              <Field label="Sexe">
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="M">Masculin</option><option value="F">Féminin</option>
                </select>
              </Field>
              <Field label="Date de naissance"><input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></Field>
              <Field label="Lieu de naissance"><input value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} /></Field>
              <Field label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Field label="Parent / Tuteur"><input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></Field>
              <Field label="Téléphone parent"><input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></Field>
              <Field label="Email parent"><input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} /></Field>
            </div>
          </form>
        )}
      </Modal>
      <Confirm
        open={!!confirmTarget}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={confirmArchive === null ? doDelete : doArchive}
        title={confirmArchive === null ? 'Supprimer cet élève ?' : (confirmArchive ? 'Restaurer cet élève ?' : 'Archiver cet élève ?')}
        message={confirmArchive === null
          ? `Voulez-vous supprimer définitivement ${confirmTarget?.first_name} ${confirmTarget?.last_name} ? Si l'élève a des données liées (paiements, notes), la suppression sera bloquée et vous devrez l'archiver.`
          : (confirmArchive
            ? `Voulez-vous restaurer ${confirmTarget?.first_name} ${confirmTarget?.last_name} ?`
            : `Voulez-vous archiver ${confirmTarget?.first_name} ${confirmTarget?.last_name} ? L'élève restera dans les archives.`)}
        confirmLabel={confirmArchive === null ? 'Supprimer' : (confirmArchive ? 'Restaurer' : 'Archiver')}
        danger={confirmArchive === null}
        loading={busy}
      />
    </div>
  );
}
