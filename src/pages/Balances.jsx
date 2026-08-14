import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Loading } from '../components';

function range(period, dateStr) {
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  if (period === 'jour') return { from: d.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
  if (period === 'semaine') {
    const day = d.getDay() || 7;
    const start = new Date(d); start.setDate(d.getDate() - day + 1);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (period === 'mois') {
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;
    return { from, to };
  }
  return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
}

export default function Balances() {
  const { school } = useApp();
  const curr = school?.currency || '';
  const [period, setPeriod] = useState('jour');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [payments, setPayments] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { from, to } = range(period, date);
    setLoading(true);
    Promise.all([
      api.get(`/payments?from=${from}&to=${to}`),
      api.get(`/transactions?from=${from}&to=${to}`)
    ]).then(([p, t]) => { setPayments(p); setTxs(t); })
      .finally(() => setLoading(false));
  }, [period, date]);

  const tuitionTotal = payments.reduce((s, p) => s + p.amount, 0);
  const entries = txs.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
  const totalIn = tuitionTotal + entries;
  const balance = totalIn - expenses;

  const labels = { jour: 'Journalière', semaine: 'Hebdomadaire', mois: 'Mensuelle', annee: 'Annuelle' };

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Consultez les balances de l'établissement par période.</p>
      </div>

      <div className="card mb-3 card-pad">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="tabs" style={{ border: 'none', margin: 0 }}>
            {Object.entries(labels).map(([k, v]) => (
              <button key={k} className={`tab ${period === k ? 'active' : ''}`} style={{ borderBottom: period === k ? '2px solid var(--primary)' : '2px solid transparent' }} onClick={() => setPeriod(k)}>{v}</button>
            ))}
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
        </div>
      </div>

      <div className="grid grid-4 mb-3">
        <div className="card stat">
          <div className="stat-ico bg-primary-light">🎓</div>
          <div><div className="stat-value">{fmt(tuitionTotal, curr)}</div><div className="stat-label">Scolarité ({labels[period].toLowerCase()})</div></div>
        </div>
        <div className="card stat">
          <div className="stat-ico bg-secondary-light">📥</div>
          <div><div className="stat-value">{fmt(entries, curr)}</div><div className="stat-label">Autres entrées</div></div>
        </div>
        <div className="card stat">
          <div className="stat-ico bg-danger-light">📤</div>
          <div><div className="stat-value text-danger">{fmt(expenses, curr)}</div><div className="stat-label">Sorties / dépenses</div></div>
        </div>
        <div className="card stat">
          <div className="stat-ico bg-success-light">⚖️</div>
          <div><div className="stat-value" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(balance, curr)}</div><div className="stat-label">Solde de la période</div></div>
        </div>
      </div>

      {loading && <Loading />}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><div className="card-title">Paiements de scolarité</div></div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Reçu</th><th>Élève</th><th>Date</th><th className="num">Montant</th></tr></thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={4} className="text-center muted">Aucun paiement sur cette période</td></tr>}
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="nowrap">{p.receipt_number}</td>
                    <td>{p.first_name} {p.last_name}</td>
                    <td>{fmtDate(p.payment_date)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmt(p.amount, curr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">Entrées & sorties</div></div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>N°</th><th>Libellé</th><th>Type</th><th className="num">Montant</th></tr></thead>
              <tbody>
                {txs.length === 0 && <tr><td colSpan={4} className="text-center muted">Aucune opération sur cette période</td></tr>}
                {txs.map(t => (
                  <tr key={t.id}>
                    <td className="nowrap">{t.invoice_number}</td>
                    <td>{t.label}</td>
                    <td><span className={`badge ${t.type === 'entree' ? 'badge-green' : 'badge-red'}`}>{t.type === 'entree' ? 'Entrée' : 'Sortie'}</span></td>
                    <td className="num" style={{ fontWeight: 600, color: t.type === 'entree' ? 'var(--success)' : 'var(--danger)' }}>
                      {t.type === 'entree' ? '+' : '−'}{fmt(t.amount, curr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
