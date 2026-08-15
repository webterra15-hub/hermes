import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Modal, Badge, Empty, Loading, Field, Confirm } from '../components';
import ReceiptView from '../components/ReceiptView';
import CertificateView from '../components/CertificateView';

export default function Scolarite() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const canWrite = ['admin', 'secretaire'].includes(user?.role);

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [moratoires, setMoratoires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('paiements');

  const [payStudent, setPayStudent] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payCategory, setPayCategory] = useState('scolarite');
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [certStudent, setCertStudent] = useState(null);

  const [showMora, setShowMora] = useState(false);
  const [moraForm, setMoraForm] = useState({ enrollment_id: '', reason: '', end_date: '', note: '' });
  const [deleteMora, setDeleteMora] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [st, cl, py, mo] = await Promise.all([
        api.get(`/students?class_id=${classFilter || ''}`),
        api.get('/classes'),
        api.get(`/payments${classFilter ? `?class_id=${classFilter}` : ''}`),
        api.get(`/moratoires${classFilter ? `?class_id=${classFilter}` : ''}`)
      ]);
      setStudents(st);
      setClasses(cl);
      setPayments(py);
      setMoratoires(mo);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [classFilter]);

  const filteredStudents = search
    ? students.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : students;

  const pay = async (e) => {
    e.preventDefault();
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return toast('Montant invalide', 'error');
    setPaying(true);
    try {
      const res = await api.post('/payments', { enrollment_id: payStudent.enrollment_id, amount: amt, note: payNote, category: payCategory });
      setReceipt(res.payment);
      toast(`Paiement enregistré — ${res.payment.receipt_number}`);
      setPayAmount(''); setPayNote(''); setPayCategory('scolarite');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setPaying(false); }
  };

  const openPay = (s) => { setPayStudent(s); setPayAmount(''); setPayNote(''); setPayCategory('scolarite'); };

  const createMora = async (e) => {
    e.preventDefault();
    if (!moraForm.enrollment_id || !moraForm.reason) return toast('Élève et motif requis', 'error');
    try {
      await api.post('/moratoires', { ...moraForm, end_date: moraForm.end_date || null });
      toast('Moratoire créé');
      setShowMora(false); setMoraForm({ enrollment_id: '', reason: '', end_date: '', note: '' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const deleteMoraDo = async () => {
    try {
      await api.del(`/moratoires/${deleteMora.id}`);
      toast('Moratoire supprimé');
      setDeleteMora(null); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="between mb-3">
        <p className="muted" style={{ maxWidth: 560 }}>
          Enregistrez ici les paiements de scolarité. Chaque paiement génère automatiquement un reçu
          remis à l'élève et met à jour son solde en temps réel.
        </p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'paiements' ? 'active' : ''}`} onClick={() => setTab('paiements')}>Paiements enregistrés</button>
        <button className={`tab ${tab === 'eleves' ? 'active' : ''}`} onClick={() => setTab('eleves')}>Élèves & soldes</button>
        <button className={`tab ${tab === 'moratoires' ? 'active' : ''}`} onClick={() => setTab('moratoires')}>Moratoires</button>
      </div>

      {tab === 'paiements' ? (
        <div className="card">
          <div className="card-header">
            <div className="row">
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Reçu</th><th>Élève</th><th>Classe</th><th>Date</th><th className="num">Montant</th><th>Enregistré par</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7}><Loading /></td></tr>}
                {!loading && payments.length === 0 && <tr><td colSpan={7}><Empty message="Aucun paiement enregistré" /></td></tr>}
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="nowrap">{p.receipt_number}</td>
                    <td style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</td>
                    <td>{p.class_name}</td>
                    <td>{fmtDate(p.payment_date)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmt(p.amount, curr)}</td>
                    <td>{p.recorder_name || '—'}</td>
                    <td className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setReceipt(p)}>Reçu</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'eleves' ? (
        <div className="card">
          <div className="card-header">
            <div className="field" style={{ margin: 0, minWidth: 260 }}>
              <input className="search-input" placeholder="Rechercher un élève…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {canWrite && <span className="muted">Cliquez sur « Payer » pour enregistrer un paiement</span>}
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Élève</th><th>Classe</th><th className="num">Scolarité</th><th className="num">Payé</th><th className="num">Reste</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7}><Loading /></td></tr>}
                {!loading && filteredStudents.filter(s => s.enrollment_id).length === 0 && <tr><td colSpan={7}><Empty message="Aucun élève inscrit dans cette classe" /></td></tr>}
                {filteredStudents.filter(s => s.enrollment_id).map(s => {
                  const tuition = s.tuition_fee || 0;
                  const paid = s.paid || 0;
                  const balance = tuition - paid;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</td>
                      <td>{s.class_name}</td>
                      <td className="num">{fmt(tuition, curr)}</td>
                      <td className="num" style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(paid, curr)}</td>
                      <td className="num" style={{ color: balance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>{fmt(balance, curr)}</td>
                      <td><Badge kind={balance <= 0 ? 'green' : 'amber'}>{balance <= 0 ? 'Soldé' : 'Partiel'}</Badge></td>
                      <td className="actions">
                        {canWrite && <button className="btn btn-secondary btn-sm" onClick={() => openPay(s)}>Payer</button>}
                        <button className="btn btn-outline btn-sm" onClick={() => setCertStudent(s)}>Certificat</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header between">
            <div className="row">
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {canWrite && <button className="btn btn-primary btn-sm" onClick={() => setShowMora(true)}>+ Moratoire</button>}
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Élève</th><th>Classe</th><th>Motif</th><th>Début</th><th>Fin</th><th>Note</th><th>Créé par</th><th></th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8}><Loading /></td></tr>}
                {!loading && moratoires.length === 0 && <tr><td colSpan={8}><Empty message="Aucun moratoire — un moratoire permet de reporter une échéance de paiement de scolarité." /></td></tr>}
                {moratoires.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.first_name} {m.last_name}</td>
                    <td>{m.class_name}</td>
                    <td>{m.reason}</td>
                    <td>{fmtDate(m.start_date)}</td>
                    <td>{m.end_date ? fmtDate(m.end_date) : '—'}</td>
                    <td className="muted">{m.note || '—'}</td>
                    <td>{m.created_by_name || '—'}</td>
                    <td className="actions">
                      {canWrite && <button className="btn btn-danger-outline btn-sm" onClick={() => setDeleteMora(m)}>Suppr.</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!payStudent}
        onClose={() => setPayStudent(null)}
        title={`Paiement — ${payStudent ? `${payStudent.first_name} ${payStudent.last_name}` : ''}`}
      >
        {payStudent && (
          <form onSubmit={pay}>
            <div className="row mb-3" style={{ alignItems: 'flex-start' }}>
              <div className="card card-pad flex-1 dashed-border" style={{ boxShadow: 'none' }}>
                <div className="muted" style={{ fontSize: 12 }}>Classe : {payStudent.class_name}</div>
                <div className="between mt-1"><span>Scolarité annuelle</span><b>{fmt(payStudent.tuition_fee || 0, curr)}</b></div>
                <div className="between mt-1"><span>Déjà payé</span><b className="text-success">{fmt(payStudent.paid || 0, curr)}</b></div>
                <div className="between mt-1"><span>Reste à payer</span><b className="text-warning">{fmt((payStudent.tuition_fee || 0) - (payStudent.paid || 0), curr)}</b></div>
              </div>
            </div>
            <div className="field">
              <label>Montant (espèces)</label>
              <input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={`Ex : 25000 ${curr}`} autoFocus required />
            </div>
            <div className="field">
              <label>Catégorie de frais</label>
              <select value={payCategory} onChange={(e) => setPayCategory(e.target.value)}>
                <option value="scolarite">Scolarité</option>
                <option value="inscription">Inscription</option>
                <option value="transport">Transport</option>
                <option value="autres">Autres</option>
              </select>
            </div>
            <div className="field">
              <label>Note (optionnel)</label>
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Ex : paiement 2e tranche" />
            </div>
            <button className="btn btn-secondary btn-lg" style={{ width: '100%' }} disabled={paying}>
              {paying ? 'Enregistrement…' : `Encaisser et générer le reçu`}
            </button>
          </form>
        )}
      </Modal>

      <Modal open={showMora} onClose={() => setShowMora(false)} title="Nouveau moratoire"
        footer={<button className="btn btn-primary" form="mora-form" type="submit">Créer</button>}>
        <form id="mora-form" onSubmit={createMora}>
          <Field label="Élève">
            <select value={moraForm.enrollment_id} onChange={(e) => setMoraForm({ ...moraForm, enrollment_id: e.target.value })} required>
              <option value="">— Choisir —</option>
              {students.filter(s => s.enrollment_id).map(s => (
                <option key={s.enrollment_id} value={s.enrollment_id}>{s.first_name} {s.last_name} — {s.class_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Motif"><input value={moraForm.reason} onChange={(e) => setMoraForm({ ...moraForm, reason: e.target.value })} placeholder="Ex : difficultés financières" required /></Field>
          <div className="form-grid">
            <Field label="Date de fin (optionnel)"><input type="date" value={moraForm.end_date} onChange={(e) => setMoraForm({ ...moraForm, end_date: e.target.value })} /></Field>
            <Field label="Note (optionnel)"><input value={moraForm.note} onChange={(e) => setMoraForm({ ...moraForm, note: e.target.value })} /></Field>
          </div>
        </form>
      </Modal>

      <ReceiptView receipt={receipt} onClose={() => setReceipt(null)} />
      <CertificateView student={certStudent} onClose={() => setCertStudent(null)} />
      <Confirm
        open={!!deleteMora}
        onCancel={() => setDeleteMora(null)}
        onConfirm={deleteMoraDo}
        title="Supprimer ce moratoire ?"
        message={`Voulez-vous supprimer le moratoire de ${deleteMora?.first_name} ${deleteMora?.last_name} ?`}
      />
    </div>
  );
}
