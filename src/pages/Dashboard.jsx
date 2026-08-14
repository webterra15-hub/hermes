import { useEffect, useState } from 'react';
import { api, fmt, fmtDate, getToken } from '../api';
import { useApp } from '../context';
import { Stat, Badge, Loading } from '../components';

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function Dashboard() {
  const { school, toast, refresh } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/dashboard');
      setData(d);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setInterval(() => { if (getToken()) load(); }, 15000);
    load();
    return () => clearInterval(t);
  }, []);

  if (loading && !data) return <Loading />;
  if (!data) return <div className="empty-state">Impossible de charger le tableau de bord.</div>;

  const { tuition, transactions, counts, recentPayments, recentTx, monthlyRevenue, year } = data;
  const curr = school?.currency || '';

  const maxMonth = Math.max(...monthlyRevenue.map(m => m.total), 1);
  const paidPct = tuition.expected ? Math.round((tuition.paid / tuition.expected) * 100) : 0;

  return (
    <div>
      <div className="between mb-3">
        <div>
          <div className="section-title">Bonjour 👋</div>
          <div className="muted">Bienvenue sur le tableau de bord — année scolaire {year?.label}</div>
        </div>
        <button className="btn btn-outline" onClick={load}>↻ Actualiser</button>
      </div>

      <div className="grid grid-4 mb-3">
        <Stat icon="🎓" color="bg-primary-light" value={fmt(tuition.paid, curr)} label="Scolarité payée (année)" delta={`${paidPct}% de ${fmt(tuition.expected, curr)} attendus`} deltaColor="text-primary" />
        <Stat icon="💵" color="bg-success-light" value={fmt(tuition.today, curr)} label="Scolarité encaissée aujourd'hui" delta="Temps réel" deltaColor="text-success" />
        <Stat icon="📥" color="bg-secondary-light" value={fmt(transactions.entries, curr)} label="Entrées (année)" delta={`+${fmt(transactions.entriesToday, curr)} aujourd'hui`} deltaColor="text-success" />
        <Stat icon="📤" color="bg-danger-light" value={fmt(transactions.expenses, curr)} label="Sorties (année)" delta={`-${fmt(transactions.expensesToday, curr)} aujourd'hui`} deltaColor="text-danger" />
      </div>

      <div className="grid grid-3 mb-3">
        <Stat icon="🧑‍🎓" color="bg-warning-light" value={counts.students} label="Élèves inscrits" />
        <Stat icon="🏫" color="bg-primary-light" value={counts.classes} label="Classes" />
        <Stat icon="⚖️" color="bg-secondary-light" value={fmt(tuition.paid + transactions.entries - transactions.expenses, curr)} label="Solde global (année)" />
      </div>

      <div className="grid grid-2 mb-3">
        <div className="card">
          <div className="card-header"><div className="card-title">Recettes de scolarité — 12 derniers mois</div></div>
          <div className="card-pad" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 170 }}>
            {monthlyRevenue.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%', maxWidth: 34, borderRadius: '6px 6px 0 0',
                  height: `${Math.max((m.total / maxMonth) * 110, m.total > 0 ? 6 : 2)}px`,
                  background: 'linear-gradient(180deg,#6366f1,#4f46e5)'
                }} title={`${MONTHS_FR[Number(m.month) - 1]} : ${fmt(m.total, curr)}`} />
                <span className="muted" style={{ fontSize: 10 }}>{MONTHS_FR[Number(m.month) - 1]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Opérations récentes</div></div>
          <div className="card-pad" style={{ paddingTop: 8 }}>
            {recentTx.length === 0 && <div className="muted">Aucune opération récente.</div>}
            {recentTx.slice(0, 5).map(tx => (
              <div key={tx.id} className="between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{tx.label}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{tx.invoice_number} · {fmtDate(tx.transaction_date)}</div>
                </div>
                <span style={{ fontWeight: 700, color: tx.type === 'entree' ? 'var(--success)' : 'var(--danger)' }}>
                  {tx.type === 'entree' ? '+' : '−'}{fmt(tx.amount, curr)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Derniers paiements de scolarité</div>
          <button className="btn btn-outline btn-sm" onClick={() => { window.location.href = '/scolarite'; }}>Voir tout</button>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Reçu</th><th>Élève</th><th>Classe</th><th>Date</th><th className="num">Montant</th><th>Solde</th></tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 && <tr><td colSpan={6} className="text-center muted">Aucun paiement enregistré.</td></tr>}
              {recentPayments.map(p => (
                <tr key={p.id}>
                  <td className="nowrap">{p.receipt_number}</td>
                  <td style={{ fontWeight: 600 }}>{p.first_name} {p.last_name}</td>
                  <td>{p.class_name}</td>
                  <td>{fmtDate(p.payment_date)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmt(p.amount, curr)}</td>
                  <td className="num"><Badge kind={p.balance ? 'amber' : 'green'}>{p.balance ? `Reste ${fmt(p.balance, curr)}` : 'Soldé'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
