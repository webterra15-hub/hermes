import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Modal, Badge, Empty, Loading } from '../components';
import ReceiptView from '../components/ReceiptView';

export default function Scolarite() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const canWrite = ['admin', 'secretaire'].includes(user?.role);

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('paiements');

  const [payStudent, setPayStudent] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [st, cl, py] = await Promise.all([
        api.get(`/students?class_id=${classFilter || ''}`),
        api.get('/classes'),
        api.get(`/payments${classFilter ? `?class_id=${classFilter}` : ''}`)
      ]);
      setStudents(st);
      setClasses(cl);
      setPayments(py);
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
      const res = await api.post('/payments', { enrollment_id: payStudent.enrollment_id, amount: amt, note: payNote });
      setReceipt(res.payment);
      toast(`Paiement enregistré — ${res.payment.receipt_number}`);
      setPayAmount(''); setPayNote('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setPaying(false); }
  };

  const openPay = (s) => { setPayStudent(s); setPayAmount(''); setPayNote(''); };

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
      ) : (
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
                      </td>
                    </tr>
                  );
                })}
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
              <label>Note (optionnel)</label>
              <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Ex : paiement 2e tranche" />
            </div>
            <button className="btn btn-secondary btn-lg" style={{ width: '100%' }} disabled={paying}>
              {paying ? 'Enregistrement…' : `Encaisser et générer le reçu`}
            </button>
          </form>
        )}
      </Modal>

      <ReceiptView receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
