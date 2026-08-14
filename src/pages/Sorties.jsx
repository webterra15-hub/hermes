import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Modal, Empty, Loading } from '../components';
import InvoiceView from '../components/InvoiceView';

export default function Sorties() {
  const { user, school, toast } = useApp();
  const curr = school?.currency || '';
  const canWrite = ['admin', 'secretaire'].includes(user?.role);

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [view, setView] = useState(null);

  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setList(await api.get('/transactions?type=sortie')); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const total = list.reduce((s, t) => s + t.amount, 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!label || !amount || amount <= 0) return toast('Libellé et montant requis', 'error');
    setBusy(true);
    try {
      const res = await api.post('/transactions', { type: 'sortie', label, category, amount: Number(amount), transaction_date: date, description: desc });
      toast(`Dépense enregistrée — ${res.transaction.invoice_number}`);
      setOpenForm(false); setLabel(''); setCategory(''); setAmount(''); setDate(''); setDesc('');
      setView(res.transaction);
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const filtered = search ? list.filter(t => `${t.label} ${t.invoice_number} ${t.category}`.toLowerCase().includes(search.toLowerCase())) : list;

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Enregistrez ici toutes les dépenses effectuées par l'établissement. Chaque sortie génère une facture.</p>
        {canWrite && <button className="btn btn-primary" onClick={() => setOpenForm(true)}>+ Nouvelle dépense</button>}
      </div>

      <div className="card mb-3 stat" style={{ maxWidth: 380 }}>
        <div className="stat-ico bg-danger-light">📤</div>
        <div>
          <div className="stat-value text-danger">{fmt(total, curr)}</div>
          <div className="stat-label">Total des dépenses enregistrées</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="search-input" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Facture</th><th>Libellé</th><th>Catégorie</th><th>Date</th><th className="num">Montant</th><th>Enregistré par</th><th></th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7}><Loading /></td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7}><Empty message="Aucune dépense enregistrée" /></td></tr>}
              {filtered.map(t => (
                <tr key={t.id}>
                  <td className="nowrap">{t.invoice_number}</td>
                  <td style={{ fontWeight: 600 }}>{t.label}</td>
                  <td>{t.category || '—'}</td>
                  <td>{fmtDate(t.transaction_date)}</td>
                  <td className="num" style={{ color: 'var(--danger)', fontWeight: 700 }}>−{fmt(t.amount, curr)}</td>
                  <td>{t.recorder_name || '—'}</td>
                  <td className="actions"><button className="btn btn-outline btn-sm" onClick={() => setView(t)}>Facture</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={openForm} onClose={() => setOpenForm(false)} title="Nouvelle dépense (sortie)">
        <form onSubmit={submit}>
          <div className="field">
            <label>Libellé</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Achat de fournitures scolaires" autoFocus required />
          </div>
          <div className="field">
            <label>Catégorie (optionnel)</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex : Fournitures, Transport, Entretien" />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Montant ({curr})</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Description (optionnel)</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer la dépense'}
          </button>
        </form>
      </Modal>

      <InvoiceView transaction={view} onClose={() => setView(null)} />
    </div>
  );
}
