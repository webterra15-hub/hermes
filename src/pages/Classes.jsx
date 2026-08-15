import { useEffect, useState } from 'react';
import { api, fmt } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading, Field, Badge, Confirm } from '../components';

export default function Classes() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const isAdmin = user?.role === 'admin';

  const [levels, setLevels] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showLevel, setShowLevel] = useState(false);
  const [levelName, setLevelName] = useState('');
  const [editLevel, setEditLevel] = useState(null);

  const [showClass, setShowClass] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [cls, setCls] = useState({ level_id: '', name: '', tuition_fee: '', teacher_user_id: '', cycle_id: '' });

  const [showSubj, setShowSubj] = useState(false);
  const [subjName, setSubjName] = useState('');
  const [subjCoef, setSubjCoef] = useState(1);
  const [editSubj, setEditSubj] = useState(null);

  const [subjectModal, setSubjectModal] = useState(null); // { id, name }
  const [subjectIds, setSubjectIds] = useState([]);
  const [subjectCoefs, setSubjectCoefs] = useState({});
  const [subjectTeacher, setSubjectTeacher] = useState({});

  const [classList, setClassList] = useState(null);

  const [showCycle, setShowCycle] = useState(false);
  const [cycleName, setCycleName] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmAction, setConfirmAction] = useState(''); // 'deleteClass' | 'archiveClass' | 'deleteLevel' | 'deleteSubject' | 'deleteCycle'

  const [cycleSubjectModal, setCycleSubjectModal] = useState(null); // cycle
  const [cycleSubjectIds, setCycleSubjectIds] = useState([]);
  const [cycleSubjectCoefs, setCycleSubjectCoefs] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [lv, cl, te, su, cy] = await Promise.all([
        api.get('/levels'), api.get('/classes'), api.get('/users'), api.get('/subjects'), api.get('/cycles')
      ]);
      setLevels(lv); setClasses(cl);
      setTeachers(te.filter(t => t.role === 'professeur' || t.role === 'admin'));
      setSubjects(su); setCycles(cy);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addLevel = async (e) => {
    e.preventDefault();
    if (!levelName) return;
    try {
      if (editLevel) {
        await api.put(`/levels/${editLevel.id}`, { name: levelName });
        toast('Niveau mis à jour');
      } else {
        await api.post('/levels', { name: levelName });
        toast('Niveau créé');
      }
      setLevelName(''); setShowLevel(false); setEditLevel(null); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const addCycle = async (e) => {
    e.preventDefault();
    if (!cycleName) return;
    try {
      await api.post('/cycles', { name: cycleName });
      toast('Cycle créé'); setCycleName(''); setShowCycle(false); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveClass = async (e) => {
    e.preventDefault();
    if (!cls.name || !cls.level_id) return toast('Nom et niveau requis', 'error');
    try {
      const body = {
        name: cls.name, level_id: cls.level_id,
        tuition_fee: Number(cls.tuition_fee) || 0,
        teacher_user_id: cls.teacher_user_id || null,
        cycle_id: cls.cycle_id || null
      };
      if (editClass) {
        await api.put(`/classes/${editClass.id}`, body);
        toast('Classe mise à jour');
      } else {
        await api.post('/classes', body);
        toast('Classe créée');
      }
      setShowClass(false); setEditClass(null); setCls({ level_id: '', name: '', tuition_fee: '', teacher_user_id: '', cycle_id: '' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const openSubjectModal = async (c) => {
    try {
      const list = await api.get(`/classes/${c.id}/subjects`);
      const links = await api.get(`/classes/${c.id}/teachers`);
      setSubjectModal(c);
      setSubjectIds(list.map(s => s.id));
      const coefs = {}; const tch = {};
      for (const s of list) coefs[s.id] = s.coefficient ?? 1;
      for (const l of links) { tch[l.subject_id] = l.teacher_user_id; }
      setSubjectCoefs(coefs); setSubjectTeacher(tch);
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveSubjects = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/classes/${subjectModal.id}/subjects`, {
        subject_ids: subjectIds,
        coefficients: Object.fromEntries(Object.entries(subjectCoefs).map(([k, v]) => [k, Number(v) || null]))
      });
      for (const [subjectId, teacherUserId] of Object.entries(subjectTeacher)) {
        if (teacherUserId) await api.post(`/classes/${subjectModal.id}/teachers`, { subject_id: subjectId, teacher_user_id: teacherUserId });
      }
      toast('Matières et enseignants enregistrés'); setSubjectModal(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  const addSubject = async (e) => {
    e.preventDefault();
    if (!subjName) return;
    try {
      if (editSubj) {
        await api.put(`/subjects/${editSubj.id}`, { name: subjName, coefficient: Number(subjCoef) || 1 });
        toast('Matière mise à jour');
      } else {
        await api.post('/subjects', { name: subjName, coefficient: Number(subjCoef) || 1 });
        toast('Matière créée');
      }
      setSubjName(''); setSubjCoef(1); setShowSubj(false); setEditSubj(null); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const openClassList = async (c) => {
    try { setClassList(await api.get(`/class-list/${c.id}`)); } catch (err) { toast(err.message, 'error'); }
  };

  const openCycleSubjectModal = async (c) => {
    try {
      const list = await api.get(`/cycles/${c.id}/subjects`);
      setCycleSubjectModal(c);
      setCycleSubjectIds(list.map(s => s.subject_id));
      const coefs = {};
      for (const s of list) coefs[s.subject_id] = s.coefficient ?? '';
      setCycleSubjectCoefs(coefs);
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveCycleSubjects = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/cycles/${cycleSubjectModal.id}/subjects`, {
        subject_ids: cycleSubjectIds,
        coefficients: Object.fromEntries(Object.entries(cycleSubjectCoefs).map(([k, v]) => [k, Number(v) || null]))
      });
      toast('Configurations du cycle enregistrées'); setCycleSubjectModal(null);
    } catch (err) { toast(err.message, 'error'); }
  };

  const doConfirm = async () => {
    try {
      if (confirmAction === 'deleteClass') {
        await api.del(`/classes/${confirmTarget.id}`);
        toast('Classe supprimée');
      } else if (confirmAction === 'archiveClass') {
        await api.post(`/classes/${confirmTarget.id}/archive`, { archived: true });
        toast('Classe archivée');
      } else if (confirmAction === 'deleteLevel') {
        await api.del(`/levels/${confirmTarget.id}`);
        toast('Niveau supprimé');
      } else if (confirmAction === 'deleteSubject') {
        await api.del(`/subjects/${confirmTarget.id}`);
        toast('Matière supprimée');
      } else if (confirmAction === 'deleteCycle') {
        await api.del(`/cycles/${confirmTarget.id}`);
        toast('Cycle supprimé');
      }
      setConfirmTarget(null); setConfirmAction(''); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Organisez les cycles, niveaux, classes, matières et professeurs de votre établissement.</p>
        {isAdmin && <div className="row">
          <button className="btn btn-outline" onClick={() => setShowSubj(true)}>+ Matière</button>
          <button className="btn btn-outline" onClick={() => setShowCycle(true)}>+ Cycle</button>
          <button className="btn btn-outline" onClick={() => setShowLevel(true)}>+ Niveau</button>
          <button className="btn btn-primary" onClick={() => { setEditClass(null); setCls({ level_id: levels[0]?.id || '', name: '', tuition_fee: '', teacher_user_id: '', cycle_id: '' }); setShowClass(true); }}>+ Classe</button>
        </div>}
      </div>

      {loading && <Loading />}
      {!loading && levels.length === 0 && <Empty message="Créez d'abord un niveau (ex : Primaire, Secondaire) puis des classes." />}

      {cycles.length > 0 && (
        <div className="mb-4">
          <div className="between mb-2">
            <div className="section-title" style={{ margin: 0 }}>Cycles</div>
            <span className="muted">Configurations communes (matières, coefficients) appliquées aux classes du cycle</span>
          </div>
          <div className="grid grid-3">
            {cycles.map(c => (
              <div key={c.id} className="card card-pad">
                <div className="between mb-2">
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                  <Badge kind="blue">{classes.filter(x => x.cycle_id === c.id).length} classe{classes.filter(x => x.cycle_id === c.id).length > 1 ? 's' : ''}</Badge>
                </div>
                {isAdmin && (
                  <div className="row mt-2">
                    <button className="btn btn-outline btn-sm" onClick={() => openCycleSubjectModal(c)}>Configurer</button>
                    <button className="btn btn-danger-outline btn-sm" onClick={() => { setConfirmTarget(c); setConfirmAction('deleteCycle'); }}>Supprimer</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {levels.map(level => {
        const levelClasses = classes.filter(c => c.level_id === level.id);
        return (
          <div key={level.id} className="mb-4">
            <div className="between mb-2">
              <div className="section-title" style={{ margin: 0 }}>{level.name}</div>
              <div className="row">
                <span className="muted">{levelClasses.length} classe{levelClasses.length > 1 ? 's' : ''}</span>
                {isAdmin && <button className="btn btn-outline btn-sm" onClick={() => { setEditLevel(level); setLevelName(level.name); setShowLevel(true); }}>Renommer</button>}
                {isAdmin && <button className="btn btn-danger-outline btn-sm" onClick={() => { setConfirmTarget(level); setConfirmAction('deleteLevel'); }}>Supprimer</button>}
              </div>
            </div>            {levelClasses.length === 0 && <div className="card card-pad muted">Aucune classe dans ce niveau.</div>}
            <div className="grid grid-3">
              {levelClasses.map(c => (
                <div key={c.id} className="card card-pad">
                  <div className="between mb-2">
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                    <Badge kind="blue">{c.student_count} élève{c.student_count > 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                    {c.cycle_name && <div>Cycle : <b style={{ color: 'var(--ink)' }}>{c.cycle_name}</b></div>}
                    <div>Scolarité : <b style={{ color: 'var(--ink)' }}>{fmt(c.tuition_fee, curr)}/an</b></div>
                    <div>Professeur principal : <b style={{ color: 'var(--ink)' }}>{c.teacher_name || '—'}</b></div>
                  </div>
                  {isAdmin && (
                    <div className="row mt-2">
                      <button className="btn btn-outline btn-sm" onClick={() => openClassList(c)}>Liste</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openSubjectModal(c)}>Matières</button>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        setEditClass(c);
                        setCls({ level_id: c.level_id, name: c.name, tuition_fee: c.tuition_fee, teacher_user_id: c.teacher_user_id || '', cycle_id: c.cycle_id || '' });
                        setShowClass(true);
                      }}>Modifier</button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setConfirmTarget(c); setConfirmAction('archiveClass'); }}>Archiver</button>
                      <button className="btn btn-danger-outline btn-sm" onClick={() => { setConfirmTarget(c); setConfirmAction('deleteClass'); }}>Suppr.</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Modal open={showLevel} onClose={() => { setShowLevel(false); setEditLevel(null); setLevelName(''); }} title={editLevel ? 'Renommer le niveau' : 'Nouveau niveau'}
        footer={<button className="btn btn-primary" form="level-form" type="submit">{editLevel ? 'Enregistrer' : 'Créer'}</button>}>
        <form id="level-form" onSubmit={addLevel}>
          <Field label="Nom du niveau"><input value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder="Ex : Primaire, Secondaire" autoFocus required /></Field>
        </form>
      </Modal>

      <Modal open={showCycle} onClose={() => { setShowCycle(false); setCycleName(''); }} title="Nouveau cycle"
        footer={<button className="btn btn-primary" form="cycle-form" type="submit">Créer</button>}>
        <form id="cycle-form" onSubmit={addCycle}>
          <Field label="Nom du cycle" hint="Ex : Cycle primaire, Cycle secondaire — permet de regrouper des classes (configurations communes : matières, coefficients)."><input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="Ex : Cycle secondaire" autoFocus required /></Field>
        </form>
      </Modal>

      <Modal open={!!cycleSubjectModal} onClose={() => setCycleSubjectModal(null)} title={`Cycle — ${cycleSubjectModal?.name || ''} : matières & coefficients`} size="lg"
        footer={<button className="btn btn-primary" form="cycle-subject-form" type="submit">Enregistrer</button>}>
        <form id="cycle-subject-form" onSubmit={saveCycleSubjects}>
          <div className="muted mb-2">Configurez ici les matières et coefficients par défaut du cycle. Ces valeurs s'appliquent aux classes du cycle, sauf si une classe définit son propre coefficient (surcharge : classe &gt; cycle &gt; établissement).</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subjects.map(s => {
              const checked = cycleSubjectIds.includes(s.id);
              return (
                <div key={s.id} className="card card-pad" style={{ boxShadow: 'none', padding: '10px 14px' }}>
                  <label className="row" style={{ cursor: 'pointer', gap: 10 }}>
                    <input type="checkbox" checked={checked}
                      onChange={(e) => {
                        setCycleSubjectIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                      }} />
                    <span style={{ flex: 1, fontWeight: 600 }}>{s.name} <span className="muted">(coef étab. : {s.coefficient})</span></span>
                    {checked && (
                      <input type="number" min="0" step="0.5" style={{ width: 80 }} placeholder="Coef"
                        value={cycleSubjectCoefs[s.id] ?? ''}
                        onChange={(e) => setCycleSubjectCoefs({ ...cycleSubjectCoefs, [s.id]: e.target.value })} />
                    )}
                  </label>
                </div>
              );
            })}
          </div>
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
            <Field label="Cycle">
              <select value={cls.cycle_id} onChange={(e) => setCls({ ...cls, cycle_id: e.target.value })}>
                <option value="">— Aucun —</option>
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Professeur principal">
              <select value={cls.teacher_user_id} onChange={(e) => setCls({ ...cls, teacher_user_id: e.target.value })}>
                <option value="">— Aucun —</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </Field>
          </div>
        </form>
      </Modal>

      <Modal open={showSubj} onClose={() => { setShowSubj(false); setEditSubj(null); setSubjName(''); setSubjCoef(1); }} title={editSubj ? 'Modifier la matière' : 'Nouvelle matière'}
        footer={<button className="btn btn-primary" form="subj-form" type="submit">{editSubj ? 'Enregistrer' : 'Créer'}</button>}>
        <form id="subj-form" onSubmit={addSubject}>
          <Field label="Nom de la matière"><input value={subjName} onChange={(e) => setSubjName(e.target.value)} placeholder="Ex : Mathématiques, Français" autoFocus required /></Field>
          <Field label="Coefficient"><input type="number" min="1" value={subjCoef} onChange={(e) => setSubjCoef(e.target.value)} /></Field>
        </form>
      </Modal>

      <Modal open={!!subjectModal} onClose={() => setSubjectModal(null)} title={`Matières — ${subjectModal?.name || ''}`} size="lg"
        footer={<button className="btn btn-primary" form="subject-form" type="submit">Enregistrer</button>}>
        <form id="subject-form" onSubmit={saveSubjects}>
          <div className="muted mb-2">Sélectionnez les matières de cette classe. Précisez le coefficient (surcharge du coefficient général) et l'enseignant affecté à la matière.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {subjects.map(s => {
              const checked = subjectIds.includes(s.id);
              return (
                <div key={s.id} className="card card-pad" style={{ boxShadow: 'none', padding: '10px 14px' }}>
                  <label className="row" style={{ cursor: 'pointer', gap: 10 }}>
                    <input type="checkbox" checked={checked}
                      onChange={(e) => {
                        setSubjectIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                      }} />
                    <span style={{ flex: 1, fontWeight: 600 }}>{s.name}</span>
                    {checked && (
                      <>
                        <input type="number" min="0" step="0.5" style={{ width: 70 }} placeholder="Coef"
                          value={subjectCoefs[s.id] ?? ''}
                          onChange={(e) => setSubjectCoefs({ ...subjectCoefs, [s.id]: e.target.value })} />
                        <select style={{ width: 'auto', maxWidth: 180 }} value={subjectTeacher[s.id] || ''}
                          onChange={(e) => setSubjectTeacher({ ...subjectTeacher, [s.id]: e.target.value })}>
                          <option value="">— Enseignant —</option>
                          {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                        </select>
                      </>
                    )}
                  </label>
                </div>
              );
            })}
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
      <Confirm
        open={!!confirmTarget}
        onCancel={() => { setConfirmTarget(null); setConfirmAction(''); }}
        onConfirm={doConfirm}
        title={confirmAction === 'deleteClass' ? 'Supprimer cette classe ?'
          : confirmAction === 'archiveClass' ? 'Archiver cette classe ?'
          : confirmAction === 'deleteLevel' ? 'Supprimer ce niveau ?'
          : confirmAction === 'deleteCycle' ? 'Supprimer ce cycle ?' : 'Supprimer cette matière ?'}
        message={confirmAction === 'deleteClass'
          ? `Voulez-vous supprimer la classe ${confirmTarget?.name} ? Si elle contient des élèves ou des évaluations, la suppression sera bloquée et vous devrez l'archiver.`
          : confirmAction === 'archiveClass'
            ? `Voulez-vous archiver la classe ${confirmTarget?.name} ? Elle restera dans les archives.`
            : confirmAction === 'deleteLevel'
              ? `Voulez-vous supprimer le niveau ${confirmTarget?.name} ? La suppression sera bloquée si des classes y sont rattachées.`
              : confirmAction === 'deleteCycle'
                ? `Voulez-vous supprimer le cycle ${confirmTarget?.name} ? La suppression sera bloquée si des classes y sont rattachées.`
                : `Voulez-vous supprimer cette matière ? La suppression sera bloquée si elle est utilisée par des classes ou des notes.`}
        confirmLabel={confirmAction === 'archiveClass' ? 'Archiver' : 'Supprimer'}
        danger={confirmAction !== 'archiveClass'}
      />
    </div>
  );
}
