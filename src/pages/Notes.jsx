import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading, Field, Badge, Confirm } from '../components';

const MENTIONS = [
  { min: 18, label: 'Félicitations', tone: 'green' },
  { min: 16, label: 'Très bien', tone: 'green' },
  { min: 14, label: 'Bien', tone: 'blue' },
  { min: 12, label: 'Assez bien', tone: 'blue' },
  { min: 10, label: 'Passable', tone: 'yellow' }
];

function mentionInfo(avg) {
  if (avg == null) return null;
  return MENTIONS.find(m => avg >= m.min) || { label: 'Insuffisant', tone: 'red' };
}

export default function Notes() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const canWrite = ['admin', 'secretaire', 'professeur'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [tab, setTab] = useState('notes');

  const [classId, setClassId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [evaluationId, setEvaluationId] = useState('');
  const [entryMode, setEntryMode] = useState('period');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);
  const [bulletinMode, setBulletinMode] = useState('sequence');
  const [groupName, setGroupName] = useState('');

  const [showEval, setShowEval] = useState(false);
  const [evalForm, setEvalForm] = useState({ name: '', subject_id: '', period_id: '', class_ids: [] });
  const [lockTarget, setLockTarget] = useState(null);
  const [planView, setPlanView] = useState(false);

  useEffect(() => {
    api.get('/classes').then(setClasses).catch(() => {});
    api.get('/periods').then(setPeriods).catch(() => {});
    api.get('/subjects').then(setSubjects).catch(() => {});
    loadEvaluations();
  }, []);

  const loadEvaluations = async () => {
    try { setEvaluations(await api.get('/evaluations')); } catch (e) {}
  };

  const load = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const q = evaluationId
        ? `/grades?class_id=${classId}&evaluation_id=${evaluationId}`
        : `/grades?class_id=${classId}&period_id=${periodId || ''}`;
      setData(await api.get(q));
    } catch (err) { toast(err.message, 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [classId, periodId, evaluationId]);

  const gradeMap = {};
  if (data) {
    for (const g of data.grades) gradeMap[`${g.enrollment_id}:${g.subject_id}`] = g.value;
  }

  const setGrade = async (enrollmentId, subjectId, value) => {
    try {
      const body = { enrollment_id: enrollmentId, subject_id: subjectId, value };
      if (evaluationId) body.evaluation_id = evaluationId;
      else body.period_id = periodId;
      await api.post('/grades', body);
    } catch (err) { toast(err.message, 'error'); }
  };

  const openBulletin = async () => {
    try {
      let q = `/bulletins?class_id=${classId}`;
      if (bulletinMode === 'sequence') q += `&period_id=${periodId}`;
      else if (bulletinMode === 'trimestre') q += `&mode=trimestre&group_name=${groupName}`;
      else q += '&mode=annee';
      const d = await api.get(q);
      setView(d);
    } catch (err) { toast(err.message, 'error'); }
  };

  const createEval = async (e) => {
    e.preventDefault();
    if (!evalForm.name || !evalForm.subject_id || !evalForm.period_id || !evalForm.class_ids.length) {
      return toast('Nom, matière, période et au moins une classe requis', 'error');
    }
    try {
      await api.post('/evaluations', evalForm);
      toast('Évaluation(s) créée(s)');
      setShowEval(false);
      setEvalForm({ name: '', subject_id: '', period_id: '', class_ids: [] });
      loadEvaluations();
    } catch (err) { toast(err.message, 'error'); }
  };

  const toggleLock = async (ev) => {
    try {
      await api.put(`/evaluations/${ev.id}`, { locked: !ev.locked });
      toast(ev.locked ? 'Évaluation déverrouillée' : 'Évaluation verrouillée');
      loadEvaluations();
    } catch (err) { toast(err.message, 'error'); }
  };

  const classInfo = classes.find(c => c.id === Number(classId));
  const periodInfo = periods.find(p => p.id === Number(periodId));
  const groupNames = [...new Set(periods.filter(p => p.group_name).map(p => p.group_name))];

  const isLocked = (() => {
    if (data?.period?.locked) return true;
    if (evaluationId && data?.evaluation?.locked) return true;
    return false;
  })();

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Saisissez les notes, gérez les évaluations et générez les bulletins (séquences, trimestres, année) avec rangs et mentions.</p>
      </div>

      <div className="tabs mb-3">
        <button className={`tab ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}>Saisie des notes</button>
        <button className={`tab ${tab === 'evaluations' ? 'active' : ''}`} onClick={() => setTab('evaluations')}>Évaluations</button>
      </div>

      {tab === 'notes' && (
        <>
          <div className="card card-pad mb-3">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0, minWidth: 200 }}>
                <label>Classe</label>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setEvaluationId(''); }}>
                  <option value="">— Choisir —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0, minWidth: 200 }}>
                <label>Mode de saisie</label>
                <select value={entryMode} onChange={(e) => { setEntryMode(e.target.value); setEvaluationId(''); }}>
                  <option value="period">Par période</option>
                  <option value="evaluation">Par évaluation</option>
                </select>
              </div>
              {entryMode === 'evaluation' ? (
                <div className="field" style={{ margin: 0, minWidth: 220 }}>
                  <label>Évaluation</label>
                  <select value={evaluationId} onChange={(e) => setEvaluationId(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {evaluations.filter(ev => !classId || ev.class_id === Number(classId)).map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name} — {ev.subject_name} {ev.period_locked || ev.locked ? ' 🔒' : ''}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="field" style={{ margin: 0, minWidth: 200 }}>
                  <label>Période</label>
                  <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {periods.map(p => <option key={p.id} value={p.id}>{p.name} {p.group_name ? `(${p.group_name})` : ''}{p.locked ? ' 🔒' : ''}</option>)}
                  </select>
                </div>
              )}
              {classId && (periodId || evaluationId) && (
                <div className="row mt-1" style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
                  <button className="btn btn-secondary" onClick={openBulletin}>📄 Bulletins</button>
                </div>
              )}
            </div>
            {isLocked && <div className="alert mt-2" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}>Cette période/évaluation est verrouillée — vous pouvez consulter mais pas modifier les notes.</div>}
          </div>

          {classId && (periodId || evaluationId) && data && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  {data.evaluation ? `Notes — ${data.evaluation.name} (${data.evaluation.subject_name})` : `Notes — ${classInfo?.name} · ${data.period?.name || ''}`}
                </div>
                <div className="muted">Cliquez sur une case pour saisir/modifier une note{data.evaluation ? ` — Coef ${data.evaluation.coefficient ?? 1}` : ''}</div>
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Élève</th>
                      {data.subjects.map(s => <th key={s.id} className="num" title={`Coefficient ${s.coefficient}`}>{s.name}{s.coefficient != null ? ` (${s.coefficient})` : ''}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={data.subjects.length + 1}><Loading /></td></tr>}
                    {!loading && data.enrollments.length === 0 && <tr><td colSpan={data.subjects.length + 1}><Empty message="Aucun élève dans cette classe" /></td></tr>}
                    {data.enrollments.map(e => (
                      <tr key={e.enrollment_id}>
                        <td style={{ fontWeight: 600 }}>{e.first_name} {e.last_name}</td>
                        {data.subjects.map(s => {
                          const val = gradeMap[`${e.enrollment_id}:${s.id}`];
                          return (
                            <td key={s.id} className="num">
                              <input
                                type="number" min="0" max="20" step="0.5"
                                defaultValue={val ?? ''}
                                disabled={isLocked || !canWrite}
                                onBlur={(ev) => {
                                  const v = ev.target.value;
                                  if (v === '' && val == null) return;
                                  const n = Number(v);
                                  if (n < 0 || n > 20 || isNaN(n)) return toast('Note invalide (0-20)', 'error');
                                  if (n !== val) setGrade(e.enrollment_id, s.id, n);
                                }}
                                onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur(); }}
                                style={{ width: 64, textAlign: 'center', padding: '6px 4px', border: val != null ? '1px solid #bbf7d0' : '1px solid var(--line)', borderRadius: 6, background: val != null ? 'var(--success-light)' : '#fff' }}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'evaluations' && (
        <>
          <div className="between mb-3">
            <p className="muted">Créez des évaluations (devoirs, compositions) pour plusieurs classes à la fois, puis saisissez les notes dans l'onglet « Saisie des notes ».</p>
            <div className="row">
              <button className={`btn ${planView ? 'btn-outline' : 'btn-secondary'}`} onClick={() => setPlanView(false)}>Liste</button>
              <button className={`btn ${planView ? 'btn-secondary' : 'btn-outline'}`} onClick={() => setPlanView(true)}>Planning</button>
              {canWrite && <button className="btn btn-primary" onClick={() => setShowEval(true)}>+ Évaluation</button>}
            </div>
          </div>

          {planView ? (
            <div className="card">
              <div className="card-header"><div className="card-title">Planning des évaluations</div><div className="muted">Groupées par date</div></div>
              <div className="card-pad">
                {evaluations.length === 0 && <Empty message="Aucune évaluation planifiée." />}
                {(() => {
                  const groups = {};
                  for (const ev of evaluations) {
                    const key = ev.date || 'non_date';
                    (groups[key] = groups[key] || []).push(ev);
                  }
                  const dates = Object.keys(groups).sort((a, b) => (a === 'non_date' ? 1 : b === 'non_date' ? -1 : a.localeCompare(b)));
                  return dates.map(key => {
                    const evs = groups[key].sort((a, b) => a.class_name.localeCompare(b.class_name));
                    const past = key !== 'non_date' && new Date(`${key}T00:00:00`) < new Date(new Date().toDateString());
                    return (
                      <div key={key} className="mb-3" style={{ borderLeft: '3px solid var(--line)', paddingLeft: 14 }}>
                        <div className="between mb-1">
                          <div style={{ fontWeight: 700 }}>{key === 'non_date' ? 'Sans date' : fmtDate(key)}</div>
                          {past && <Badge kind="gray">Passée</Badge>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {evs.map(ev => (
                            <div key={ev.id} className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                              <span className="badge badge-blue">{ev.class_name}</span>
                              <b>{ev.name}</b>
                              <span className="muted">{ev.subject_name} · {ev.period_name} {ev.period_group ? `(${ev.period_group})` : ''}</span>
                              {ev.locked ? <Badge kind="red">Verrouillée</Badge> : <Badge kind="green">Ouverte</Badge>}
                              {isAdmin && (
                                <button className={`btn btn-sm ${ev.locked ? 'btn-danger' : 'btn-outline'}`} onClick={() => toggleLock(ev)}>
                                  {ev.locked ? 'Déverrouiller' : 'Verrouiller'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
          <div className="card">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Évaluation</th><th>Matière</th><th>Classe(s)</th><th>Période</th><th>Date</th><th className="num">Notes</th><th>Verrouillage</th></tr>
                </thead>
                <tbody>
                  {evaluations.length === 0 && <tr><td colSpan={7}><Empty message="Aucune évaluation — créez-en une pour organiser la saisie des notes par devoir." /></td></tr>}
                  {evaluations.map(ev => (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: 600 }}>{ev.name}</td>
                      <td>{ev.subject_name}</td>
                      <td>{ev.class_name}</td>
                      <td>{ev.period_name} {ev.period_group ? `(${ev.period_group})` : ''}</td>
                      <td>{ev.date ? fmtDate(ev.date) : '—'}</td>
                      <td className="num">{ev.grade_count}</td>
                      <td>
                        {isAdmin ? (
                          <button className={`btn btn-sm ${ev.locked ? 'btn-danger' : 'btn-outline'}`} onClick={() => toggleLock(ev)}>
                            {ev.locked ? '🔒 Verrouillée' : 'Verrouiller'}
                          </button>
                        ) : (
                          <Badge kind={ev.locked ? 'red' : 'blue'}>{ev.locked ? 'Verrouillée' : 'Ouverte'}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      )}

      <Modal open={showEval} onClose={() => setShowEval(false)} title="Nouvelle évaluation"
        footer={<button className="btn btn-primary" form="eval-form" type="submit">Créer</button>}>
        <form id="eval-form" onSubmit={createEval}>
          <div className="form-grid">
            <Field label="Nom"><input value={evalForm.name} onChange={(e) => setEvalForm({ ...evalForm, name: e.target.value })} placeholder="Ex : Devoir 1, Composition 1" required /></Field>
            <Field label="Matière">
              <select value={evalForm.subject_id} onChange={(e) => setEvalForm({ ...evalForm, subject_id: e.target.value })} required>
                <option value="">—</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Période">
              <select value={evalForm.period_id} onChange={(e) => setEvalForm({ ...evalForm, period_id: e.target.value })} required>
                <option value="">—</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name} {p.group_name ? `(${p.group_name})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={evalForm.date} onChange={(e) => setEvalForm({ ...evalForm, date: e.target.value })} /></Field>
          </div>
          <Field label="Classes concernées" hint="L'évaluation est créée dans chaque classe sélectionnée">
            <div className="grid grid-2">
              {classes.map(c => (
                <label key={c.id} className="row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={evalForm.class_ids.includes(c.id)}
                    onChange={(e) => setEvalForm({
                      ...evalForm,
                      class_ids: e.target.checked ? [...evalForm.class_ids, c.id] : evalForm.class_ids.filter(x => x !== c.id)
                    })} />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </Field>
        </form>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={`Bulletins — ${view?.classInfo?.name || ''}`} size="lg"
        footer={
          <>
            {!view?.locked && canWrite && (
              <button className="btn btn-outline" onClick={() => setView({ ...view, editObs: true })}>Appréciation / Observation</button>
            )}
            <button className="btn btn-outline" onClick={() => setView(null)}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>Imprimer les bulletins</button>
          </>
        }>
        {view && (
          <>
            <div className="card card-pad no-print mb-3" style={{ boxShadow: 'none' }}>
              <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ margin: 0 }}>
                  <label>Mode de bulletin</label>
                  <select value={view.mode || bulletinMode} onChange={(e) => {
                    const m = e.target.value;
                    setBulletinMode(m);
                    if (m === 'sequence') api.get(`/bulletins?class_id=${classId}&period_id=${periodId || (view.periods[0]?.id) || ''}`).then(d => setView(d)).catch(() => {});
                    else if (m === 'trimestre') api.get(`/bulletins?class_id=${classId}&mode=trimestre&group_name=${groupNames[0] || ''}`).then(d => setView(d)).catch(() => {});
                    else api.get(`/bulletins?class_id=${classId}&mode=annee`).then(d => setView(d)).catch(() => {});
                  }}>
                    <option value="sequence">Séquence</option>
                    <option value="trimestre">Trimestre</option>
                    <option value="annee">Année</option>
                  </select>
                </div>
                {view.mode === 'sequence' && (
                  <div className="field" style={{ margin: 0 }}>
                    <label>Séquence</label>
                    <select value={view.period?.id || ''} onChange={(e) => api.get(`/bulletins?class_id=${classId}&period_id=${e.target.value}`).then(d => setView(d)).catch(() => {})}>
                      {periods.map(p => <option key={p.id} value={p.id}>{p.name}{p.locked ? ' 🔒' : ''}</option>)}
                    </select>
                  </div>
                )}
                {view.mode === 'trimestre' && (
                  <div className="field" style={{ margin: 0 }}>
                    <label>Trimestre</label>
                    <select value={view.group_name || groupName} onChange={(e) => api.get(`/bulletins?class_id=${classId}&mode=trimestre&group_name=${e.target.value}`).then(d => setView(d)).catch(() => {})}>
                      {groupNames.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
                <div className="muted" style={{ alignSelf: 'flex-end', paddingBottom: 6 }}>
                  {view.locked && <Badge kind="red">Verrouillé</Badge>}
                  {view.observation && <span style={{ marginLeft: 8 }}>Observation : <i>{view.observation}</i></span>}
                </div>
              </div>
            </div>

            {view.editObs && (
              <ObsEditor view={view} classId={classId} toast={toast} onSaved={(d) => setView(d)} />
            )}

            <div className="print-area">
              {view.bulletins.map(b => {
                const mention = mentionInfo(b.average);
                return (
                  <div key={b.enrollment_id} className="doc mb-3" style={{ pageBreakAfter: 'always', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 16 }}>
                    <div className="doc-header">
                      <div>
                        {view.school?.logo_url && <img className="doc-logo" src={view.school.logo_url} alt="logo" />}
                        <div className="doc-school-name">{view.school?.name}</div>
                        <div className="doc-school-meta">{view.school?.address || ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="doc-receipt-number">BULLETIN DE NOTES</div>
                        <div className="muted">
                          {view.mode === 'sequence' ? view.periods.map(p => p.name).join(', ') : view.mode === 'trimestre' ? `Trimestre ${view.group_name}` : 'Année'} — {view.year_label || ''}
                        </div>
                      </div>
                    </div>
                    <div className="doc-title">{view.classInfo?.name} — {view.classInfo?.level_name || ''}</div>
                    <table className="doc-table mb-2">
                      <tbody>
                        <tr><th style={{ width: '20%' }}>Élève</th><td><b>{b.first_name} {b.last_name}</b></td></tr>
                      </tbody>
                    </table>
                    <table className="doc-table">
                      <thead><tr><th>Matière</th><th className="num">Coefficient</th><th className="num">Note /20</th><th className="num">Points</th></tr></thead>
                      <tbody>
                        {b.rows.length === 0 && <tr><td colSpan={4} className="text-center muted">Aucune note saisie</td></tr>}
                        {b.rows.map(r => (
                          <tr key={r.subject}>
                            <td>{r.subject}</td>
                            <td className="num">{r.coefficient}</td>
                            <td className="num"><b>{r.value != null ? r.value.toFixed(2) : '—'}</b></td>
                            <td className="num">{r.weighted != null ? r.weighted.toFixed(2) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr><th colSpan={2}>MOYENNE GÉNÉRALE</th><th className="num" style={{ fontSize: 15 }}>{b.average != null ? b.average.toFixed(2) : '—'}</th><th className="num">{b.sumWeighted != null ? `${b.sumWeighted.toFixed(2)} / ${b.totalCoef}` : '—'}</th></tr>
                      </tfoot>
                    </table>
                    <div className="row mt-2" style={{ gap: 24, flexWrap: 'wrap' }}>
                      <div><span className="muted">Rang : </span><b>{b.rank != null ? `${b.rank}ᵉ` : '—'}</b></div>
                      {mention && <div><span className="muted">Mention : </span><Badge kind={mention.tone}>{mention.label}</Badge></div>}
                      {b.appreciation && <div style={{ flex: 1, minWidth: 200 }}><span className="muted">Appréciation : </span><i>{b.appreciation}</i></div>}
                    </div>
                    {view.observation && <div className="muted mt-2">Observation de la classe : <i>{view.observation}</i></div>}
                    <div className="doc-foot">
                      <div>
                        <div className="muted">Professeur principal</div>
                        <div style={{ height: 30 }} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div className="muted">Le Directeur</div>
                        <div style={{ height: 30 }} />
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="muted">Le Parent</div>
                        <div style={{ height: 30 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function ObsEditor({ view, classId, toast, onSaved }) {
  const [obs, setObs] = useState(view.observation || '');
  const [apps, setApps] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (view.mode === 'sequence' && view.period?.id) {
      api.get(`/appreciations?class_id=${classId}&period_id=${view.period.id}`).then(res => {
        setApps(res.appreciations || {});
        if (res.observation) setObs(res.observation);
      }).catch(() => {});
    }
  }, [view.period?.id]);

  const save = async () => {
    setBusy(true);
    try {
      if (view.mode === 'sequence' && view.period?.id) {
        for (const b of view.bulletins) {
          const text = apps[b.enrollment_id] || '';
          if (text.trim()) await api.post('/appreciations', { enrollment_id: b.enrollment_id, period_id: view.period.id, text });
        }
      }
      await api.post('/class-observations', { class_id: classId, period_id: view.mode === 'sequence' && view.period?.id ? view.period.id : (view.periods[0]?.id || 0), text: obs });
      toast('Appréciations et observation enregistrées');
      const d = await api.get(`/bulletins?class_id=${classId}&period_id=${view.period?.id || view.periods[0]?.id}`);
      onSaved({ ...d, editObs: false });
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="card card-pad mb-3 no-print" style={{ boxShadow: 'none' }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Appréciations & observation</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {view.bulletins.map(b => (
          <div key={b.enrollment_id} className="row" style={{ gap: 10 }}>
            <span style={{ minWidth: 160, fontWeight: 600 }}>{b.first_name} {b.last_name}</span>
            <input value={apps[b.enrollment_id] || ''} placeholder="Appréciation…"
              onChange={(e) => setApps({ ...apps, [b.enrollment_id]: e.target.value })}
              style={{ flex: 1 }} />
          </div>
        ))}
      </div>
      <Field label="Observation de la classe"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ex : Bon comportement général…" /></Field>
      <div className="row mt-2">
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? '…' : 'Enregistrer'}</button>
        <button className="btn btn-outline" onClick={() => onSaved({ ...view, editObs: false })}>Annuler</button>
      </div>
    </div>
  );
}
