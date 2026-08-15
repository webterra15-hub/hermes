import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { useApp } from '../context';
import { Loading, Empty } from '../components';
import { DocumentShell } from '../components';
import { Modal } from '../components';

export default function Reports() {
  const { school } = useApp();
  const curr = school?.currency || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [print, setPrint] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get(`/reports?from=${from}&to=${to}`).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [from, to]);

  const { totals, global, payments, transactions, overview } = data || {};
  const balance = (totals?.tuition || 0) + (totals?.entries || 0) - (totals?.expenses || 0);

  return (
    <div>
      <div className="between mb-3">
        <p className="muted">Rapport financier : recettes de scolarité, autres entrées, dépenses et solde, avec vue d'ensemble des soldes élèves.</p>
        <div className="row">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
          <span className="muted">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
          <button className="btn btn-primary" onClick={() => setPrint(true)}>Imprimer / PDF</button>
        </div>
      </div>

      {loading && <Loading />}

      {data && (
        <>
          <div className="grid grid-4 mb-3">
            <div className="card stat">
              <div className="stat-ico bg-primary-light">🎓</div>
              <div><div className="stat-value">{fmt(totals?.tuition, curr)}</div><div className="stat-label">Scolarité encaissée</div></div>
            </div>
            <div className="card stat">
              <div className="stat-ico bg-secondary-light">📥</div>
              <div><div className="stat-value">{fmt(totals?.entries, curr)}</div><div className="stat-label">Autres entrées</div></div>
            </div>
            <div className="card stat">
              <div className="stat-ico bg-danger-light">📤</div>
              <div><div className="stat-value text-danger">{fmt(totals?.expenses, curr)}</div><div className="stat-label">Dépenses</div></div>
            </div>
            <div className="card stat">
              <div className="stat-ico bg-success-light">⚖️</div>
              <div><div className="stat-value" style={{ color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(balance, curr)}</div><div className="stat-label">Solde de la période</div></div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">
              <div className="card-title">Vue d'ensemble — scolarité attendue</div>
              <div className="row" style={{ gap: 16 }}>
                <span>Attendu : <b>{fmt(global?.expected, curr)}</b></span>
                <span>Payé : <b className="text-success">{fmt(global?.paid, curr)}</b></span>
                <span>Restant : <b className="text-warning">{fmt(global?.remaining, curr)}</b></span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Élève</th><th>Classe</th><th className="num">Attendu</th><th className="num">Payé</th><th className="num">Restant</th></tr></thead>
                <tbody>
                  {overview.length === 0 && <tr><td colSpan={5} className="text-center muted">Aucun élève inscrit</td></tr>}
                  {overview.map(o => (
                    <tr key={o.enrollment_id}>
                      <td style={{ fontWeight: 600 }}>{o.first_name} {o.last_name}</td>
                      <td>{o.class_name}</td>
                      <td className="num">{fmt(o.tuition, curr)}</td>
                      <td className="num text-success">{fmt(o.paid, curr)}</td>
                      <td className="num" style={{ color: o.remaining > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>{fmt(o.remaining, curr)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th colSpan={2}>TOTAUX</th><th className="num">{fmt(global?.expected, curr)}</th><th className="num">{fmt(global?.paid, curr)}</th><th className="num">{fmt(global?.remaining, curr)}</th></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">Paiements de scolarité</div><div className="muted">Total : <b>{fmt(totals?.tuition, curr)}</b></div></div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Reçu</th><th>Élève</th><th>Date</th><th className="num">Montant</th></tr></thead>
                  <tbody>
                    {payments.length === 0 && <tr><td colSpan={4} className="text-center muted">Aucun paiement</td></tr>}
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
              <div className="card-header"><div className="card-title">Entrées & sorties</div><div className="muted">Entrées : <b>{fmt(totals?.entries, curr)}</b> · Dépenses : <b>{fmt(totals?.expenses, curr)}</b></div></div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>N°</th><th>Libellé</th><th>Type</th><th className="num">Montant</th></tr></thead>
                  <tbody>
                    {transactions.length === 0 && <tr><td colSpan={4} className="text-center muted">Aucune opération</td></tr>}
                    {transactions.map(t => (
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
        </>
      )}

      <Modal open={print} onClose={() => setPrint(false)} title="Aperçu du rapport financier" size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setPrint(false)}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / PDF</button>
          </>
        }>
        {data && (
          <DocumentShell
            school={school}
            docNumber="RAPPORT FINANCIER"
            docKind="FINANCES"
            kindTone="blue"
            date={`Du ${fmtDate(from)} au ${fmtDate(to)}`}
            title="Rapport financier de l'établissement"
            footer={
              <div className="doc-foot">
                <div />
                <div style={{ textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Signature et cachet</div>
                  <div style={{ height: 40 }} />
                </div>
                <div />
              </div>
            }>
            <table className="doc-table">
              <tbody>
                <tr><th style={{ width: '40%' }}>Scolarité encaissée</th><td><b>{fmt(totals?.tuition, curr)}</b></td></tr>
                <tr><th>Autres entrées</th><td><b>{fmt(totals?.entries, curr)}</b></td></tr>
                <tr><th>Dépenses</th><td><b>{fmt(totals?.expenses, curr)}</b></td></tr>
                <tr><th>TOTAL RECETTES</th><td><b>{fmt(totals?.tuition + totals?.entries, curr)}</b></td></tr>
                <tr><th>SOLDE</th><td><b style={{ color: balance >= 0 ? '#166534' : '#b91c1c' }}>{fmt(balance, curr)}</b></td></tr>
              </tbody>
            </table>
            <div className="muted" style={{ margin: '14px 0 6px', fontSize: 13 }}>Vue d'ensemble scolarité (attendu / payé / restant)</div>
            <table className="doc-table">
              <thead><tr><th>Élève</th><th className="num">Attendu</th><th className="num">Payé</th><th className="num">Restant</th></tr></thead>
              <tbody>
                {overview.map(o => (
                  <tr key={o.enrollment_id}>
                    <td>{o.first_name} {o.last_name}</td>
                    <td className="num">{fmt(o.tuition, curr)}</td>
                    <td className="num">{fmt(o.paid, curr)}</td>
                    <td className="num">{fmt(o.remaining, curr)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th>TOTAUX</th><th className="num">{fmt(global?.expected, curr)}</th><th className="num">{fmt(global?.paid, curr)}</th><th className="num">{fmt(global?.remaining, curr)}</th></tr>
              </tfoot>
            </table>
          </DocumentShell>
        )}
      </Modal>
    </div>
  );
}
