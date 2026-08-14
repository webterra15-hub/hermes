import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading } from '../components';

export default function Notes() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const canWrite = ['admin', 'secretaire', 'professeur'].includes(user?.role);

  const [classes, setClasses] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [classId, setClassId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);

  useEffect(() => {
    api.get('/classes').then(setClasses).catch(() => {});
    api.get('/periods').then(setPeriods).catch(() => {});
  }, []);

  const load = async () => {
    if (!classId || !periodId) return;
    setLoading(true);
    try { setData(await api.get(`/grades?class_id=${classId}&period_id=${periodId}`)); }
    catch (err) { toast(err.message, 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [classId, periodId]);

  const gradeMap = {};
  if (data) {
    for (const g of data.grades) gradeMap[`${g.enrollment_id}:${g.subject_id}`] = g.value;
  }

  const setGrade = async (enrollmentId, subjectId, value) => {
    try {
      await api.post('/grades', { enrollment_id: enrollmentId, subject_id: subjectId, period_id: periodId, value });
    } catch (err) { toast(err.message, 'error'); }
  };

  const openBulletin = async (period) => {
    try {
      const d = await api.get(`/bulletins?class_id=${classId}&period_id=${period.id}`);
      setView({ ...d, period });
    } catch (err) { toast(err.message, 'error'); }
  };

  const classInfo = classes.find(c => c.id === Number(classId));
  const periodInfo = periods.find(p => p.id === Number(periodId));

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Saisissez les notes (sur 20) et générez les bulletins par classe et par période.</p>
      </div>

      <div className="card card-pad mb-3">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="field" style={{ margin: 0, minWidth: 240 }}>
            <label>Classe</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— Choisir —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, minWidth: 200 }}>
            <label>Période</label>
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="">— Choisir —</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {classId && periodId && (
            <div className="row mt-1" style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
              <button className="btn btn-secondary" onClick={() => openBulletin(periodInfo)}>📄 Voir les bulletins</button>
            </div>
          )}
        </div>
      </div>

      {classId && periodId && data && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Notes — {classInfo?.name} · {periodInfo?.name}</div>
            <div className="muted">Cliquez sur une case pour saisir/modifier une note</div>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Élève</th>
                  {data.subjects.map(s => <th key={s.id} className="num" title={`Coefficient ${s.coefficient}`}>{s.name}</th>)}
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
                            onBlur={(ev) => {
                              const v = ev.target.value;
                              if (v === '' && val == null) return;
                              if (v === '' && val != null) return;
                              const n = Number(v);
                              if (n < 0 || n > 20 || isNaN(n)) return toast('Note invalide (0-20)', 'error');
                              if (n !== val) { setGrade(e.enrollment_id, s.id, n); }
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

      <Modal open={!!view} onClose={() => setView(null)} title={`Bulletins — ${view?.classInfo?.name || ''} · ${view?.period?.name || ''}`} size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setView(null)}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>Imprimer les bulletins</button>
          </>
        }>
        {view && (
          <div className="print-area">
            {view.bulletins.map((b, idx) => (
              <div key={b.enrollment_id} className="doc mb-3" style={{ pageBreakAfter: 'always', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 16 }}>
                <div className="doc-header">
                  <div>
                    {view.school.logo_url && <img className="doc-logo" src={view.school.logo_url} alt="logo" />}
                    <div className="doc-school-name">{view.school.name}</div>
                    <div className="doc-school-meta">{view.school.address || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="doc-receipt-number">BULLETIN DE NOTES</div>
                    <div className="muted">{view.period?.name} — Année scolaire {view.year_label || ''}</div>
                  </div>
                </div>
                <div className="doc-title">{view.classInfo?.name} — {view.classInfo?.level_name}</div>
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
                        <td className="num"><b>{r.value.toFixed(2)}</b></td>
                        <td className="num">{r.weighted.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><th colSpan={2}>MOYENNE GÉNÉRALE</th><th className="num" style={{ fontSize: 15 }}>{b.average != null ? b.average.toFixed(2) : '—'}</th><th className="num">{b.sumWeighted.toFixed(2)} / {b.totalCoef}</th></tr>
                  </tfoot>
                </table>
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
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
