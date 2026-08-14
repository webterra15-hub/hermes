import { useEffect, useState } from 'react';
import { api, fmt } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading, Field, Badge } from '../components';

export default function Classes() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const isAdmin = user?.role === 'admin';

  const [levels, setLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showLevel, setShowLevel] = useState(false);
  const [levelName, setLevelName] = useState('');

  const [showClass, setShowClass] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [cls, setCls] = useState({ level_id: '', name: '', tuition_fee: '', teacher_user_id: '' });

  const [showSubj, setShowSubj] = useState(false);
  const [subjName, setSubjName] = useState('');
  const [subjCoef, setSubjCoef] = useState(1);

  const [subjectModal, setSubjectModal] = useState(null); // { id, name }
  const [subjectIds, setSubjectIds] = useState([]);

  const [classList, setClassList] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [lv, cl, te, su] = await Promise.all([
        api.get('/levels'), api.get('/classes'), api.get('/users'), api.get('/subjects')
      ]);
      setLevels(lv); setClasses(cl);
      setTeachers(te.filter(t => t.role === 'professeur' || t.role === 'admin'));
      setSubjects(su);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addLevel = async (e) => {
    e.preventDefault();
    if (!levelName) return;
    try {
      await api.post('/levels', { name: levelName });
      toast('Niveau créé'); setLevelName(''); setShowLevel(false); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveClass = async (e) => {
    e.preventDefault();
    if (!cls.name || !cls.level_id) return toast('Nom et niveau requis', 'error');
    try {
      if (editClass) {
        await api.put(`/classes/${editClass.id}`, { ...cls, tuition_fee: Number(cls.tuition_fee) || 0, teacher_user_id: cls.teacher_user_id || null });
        toast('Classe mise à jour');
      } else {
        await api.post('/classes', { ...cls, tuition_fee: Number(cls.tuition_fee) || 0, teacher_user_id: cls.teacher_user_id || null });
        toast('Classe créée');
      }
      setShowClass(false); setEditClass(null); setCls({ level_id: '', name: '', tuition_fee: '', teacher_user_id: '' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const openSubjectModal = async (c) => {
    try {
      const list = await api.get(`/classes/${c.id}/subjects`);
      setSubjectModal(c); setSubjectIds(list.map(s => s.id));
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveSubjects = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/classes/${subjectModal.id}/subjects`, { subject_ids: subjectIds });
      toast('Matières enregistrées'); setSubjectModal(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!subjName) return;
    try {
      await api.post('/subjects', { name: subjName, coefficient: Number(subjCoef) || 1 });
      toast('Matière créée'); setSubjName(''); setSubjCoef(1); setShowSubj(false); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const openClassList = async (c) => {
    try { setClassList(await api.get(`/class-list/${c.id}`)); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Organisez les niveaux, classes, matières et professeurs principaux de votre établissement.</p>
        {isAdmin && <div className="row">
          <button className="btn btn-outline" onClick={() => setShowSubj(true)}>+ Matière</button>
          <button className="btn btn-outline" onClick={() => setShowLevel(true)}>+ Niveau</button>
          <button className="btn btn-primary" onClick={() => { setEditClass(null); setCls({ level_id: levels[0]?.id || '', name: '', tuition_fee: '', teacher_user_id: '' }); setShowClass(true); }}>+ Classe</button>
        </div>}
      </div>

      {loading && <Loading />}
      {!loading && levels.length === 0 && <Empty message="Créez d'abord un niveau (ex : Primaire, Secondaire) puis des classes." />}

      {levels.map(level => {
        const levelClasses = classes.filter(c => c.level_id === level.id);
        return (
          <div key={level.id} className="mb-4">
            <div className="between mb-2">
              <div className="section-title" style={{ margin: 0 }}>{level.name}</div>
              <span className="muted">{levelClasses.length} classe{levelClasses.length > 1 ? 's' : ''}</span>
            </div>
            {levelClasses.length === 0 && <div className="card card-pad muted">Aucune classe dans ce niveau.</div>}
            <div className="grid grid-3">
              {levelClasses.map(c => (
                <div key={c.id} className="card card-pad">
                  <div className="between mb-2">
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                    <Badge kind="blue">{c.student_count} élève{c.student_count > 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                    <div>Scolarité : <b style={{ color: 'var(--ink)' }}>{fmt(c.tuition_fee, curr)}/an</b></div>
                    <div>Professeur principal : <b style={{ color: 'var(--ink)' }}>{c.teacher_name || '—'}</b></div>
                  </div>
                  {isAdmin && (
                    <div className="row mt-2">
                      <button className="btn btn-outline btn-sm" onClick={() => openClassList(c)}>Liste</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openSubjectModal(c)}>Matières</button>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        setEditClass(c);
                        setCls({ level_id: c.level_id, name: c.name, tuition_fee: c.tuition_fee, teacher_user_id: c.teacher_user_id || '' });
                        setShowClass(true);
                      }}>Modifier</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Modal open={showLevel} onClose={() => setShowLevel(false)} title="Nouveau niveau"
        footer={<button className="btn btn-primary" form="level-form" type="submit">Créer</button>}>
        <form id="level-form" onSubmit={addLevel}>
          <Field label="Nom du niveau"><input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="Ex : Primaire, Secondaire" autoFocus required /></Field>
        </form>
      </Modal>

      <Modal open={showClass} onClose={() => { setShowClass(false); setEditClass(null); }} title={editClass ? 'Modifier la classe' : 'Nouvelle classe'}
        footer={<button className="btn btn-primary" form="class-form" type="submit">{editClass ? 'Enregistrer' : 'Créer'}</button>}>
        <form id="class-form" onSubmit={saveClass}>
          <div className="form-grid">
            <Field label="Niveau">
              <select value={cls.level_id} onChange={(e) => setCls({ ...cls, level_id: e.target.value })} required>
                <option value="">—</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Nom de la classe"><input value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} placeholder="Ex : CP1, 6ème A" required /></Field>
            <Field label={`Scolarité annuelle (${curr})`}><input type="number" min="0" value={cls.tuition_fee} onChange={(e) => setCls({ ...cls, tuition_fee: e.target.value })} /></Field>
            <Field label="Professeur principal">
              <select value={cls.teacher_user_id} onChange={(e) => setCls({ ...cls, teacher_user_id: e.target.value })}>
                <option value="">— Aucun —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
          </div>
        </form>
      </Modal>

      <Modal open={showSubj} onClose={() => setShowSubj(false)} title="Nouvelle matière"
        footer={<button className="btn btn-primary" form="subj-form" type="submit">Créer</button>}>
        <form id="subj-form" onSubmit={addSubject}>
          <Field label="Nom de la matière"><input value={subjName} onChange={(e) => setSubjName(e.target.value)} placeholder="Ex : Mathématiques, Français" autoFocus required /></Field>
          <Field label="Coefficient"><input type="number" min="1" value={subjCoef} onChange={(e) => setSubjCoef(e.target.value)} /></Field>
        </form>
      </Modal>

      <Modal open={!!subjectModal} onClose={() => setSubjectModal(null)} title={`Matières — ${subjectModal?.name || ''}`}
        footer={<button className="btn btn-primary" form="subject-form" type="submit">Enregistrer</button>}>
        <form id="subject-form" onSubmit={saveSubjects}>
          <div className="muted mb-2">Sélectionnez les matières enseignées dans cette classe.</div>
          <div className="grid grid-2">
            {subjects.map(s => (
              <label key={s.id} className="row card card-pad" style={{ cursor: 'pointer', gap: 10, padding: '10px 14px' }}>
                <input type="checkbox" checked={subjectIds.includes(s.id)}
                  onChange={(e) => {
                    setSubjectIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                  }} />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        </form>
      </Modal>

      <Modal open={!!classList} onClose={() => setClassList(null)} title={`Liste des élèves — ${classList?.classInfo?.name || ''}`} size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setClassList(null)}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / PDF</button>
          </>
        }>
        {classList && (
          <div className="print-area doc-page">
            <div className="doc">
              <div className="doc-header">
                <div>
                  {classList.school.logo_url && <img className="doc-logo" src={classList.school.logo_url} alt="logo" />}
                  <div className="doc-school-name">{classList.school.name}</div>
                  <div className="doc-school-meta">{classList.school.address || ''} — Tél : {classList.school.phone || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="doc-receipt-number">LISTE DES ÉLÈVES</div>
                  <div className="muted">Année scolaire {classList.year_label}</div>
                </div>
              </div>
              <div className="doc-title">Classe : {classList.classInfo.name} ({classList.classInfo.level_name})</div>
              <table className="doc-table">
                <thead>
                  <tr><th style={{ width: 36 }}>N°</th><th>Nom</th><th>Prénom</th><th>Sexe</th><th>Date de naissance</th><th>Parent</th><th>Téléphone</th></tr>
                </thead>
                <tbody>
                  {classList.students.length === 0 && <tr><td colSpan={7} className="text-center muted">Aucun élève</td></tr>}
                  {classList.students.map((s, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{s.last_name}</td>
                      <td>{s.first_name}</td>
                      <td>{s.gender}</td>
                      <td>{s.birth_date || '—'}</td>
                      <td>{s.parent_name || '—'}</td>
                      <td>{s.parent_phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="doc-foot">
                <div><div className="muted">Effectif : {classList.students.length}</div></div>
                <div style={{ textAlign: 'center' }}>
                  <div className="muted">Signature et cachet</div>
                  <div style={{ height: 40 }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
