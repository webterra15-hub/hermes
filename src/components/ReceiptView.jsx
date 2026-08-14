import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { Modal } from '../components';

export default function ReceiptView({ receipt, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (receipt) {
      setLoading(true);
      api.get(`/receipts/${receipt.id}`).then(d => setData(d)).catch(() => setData(null)).finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [receipt]);

  if (!receipt) return null;
  const r = data?.receipt;
  const sch = data?.school;

  return (
    <Modal open onClose={onClose} title="Reçu de paiement de scolarité" size="lg"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / PDF</button>
        </>
      }>
      <div className="no-print" style={{ marginBottom: 12 }}>
        {loading && <div className="muted">Chargement du reçu…</div>}
      </div>
      <div className="print-area doc-page">
        <div className="doc">
          {r && sch && (
            <>
              <div className="doc-header">
                <div>
                  {sch.logo_url && <img className="doc-logo" src={sch.logo_url} alt="logo" />}
                  <div className="doc-school-name">{sch.name}</div>
                  <div className="doc-school-meta">
                    {sch.type === 'primaire' ? 'Établissement primaire' : sch.type === 'secondaire' ? 'Établissement secondaire' : sch.type}<br />
                    {sch.address && <span>{sch.address}<br /></span>}
                    {sch.phone && <span>Tél : {sch.phone} — </span>}
                    {sch.email && <span>{sch.email}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="doc-receipt-number">REÇU N° {r.receipt_number}</div>
                  <div className="muted">Date : {fmtDate(r.payment_date)}</div>
                  <div style={{ marginTop: 8 }} className="badge badge-green">SCoLARITÉ</div>
                </div>
              </div>
              <div className="doc-title">Reçu de paiement de scolarité</div>
              <table className="doc-table">
                <tbody>
                  <tr><th style={{ width: '35%' }}>Élève</th><td><b>{r.first_name} {r.last_name}</b></td></tr>
                  <tr><th>Classe</th><td>{r.class_name} ({r.level_name}) — Année {r.year_label}</td></tr>
                  {r.parent_name && <tr><th>Parent / Tuteur</th><td>{r.parent_name}</td></tr>}
                  <tr><th>Montant payé</th><td><b>{fmt(r.amount, sch.currency)}</b> — Espèces</td></tr>
                  <tr><th>Scolarité annuelle</th><td>{fmt(r.tuition_fee, sch.currency)}</td></tr>
                  <tr><th>Total payé à ce jour</th><td>{fmt(data.stats.paid, sch.currency)}</td></tr>
                  <tr><th>Reste à payer</th><td>{fmt(data.stats.balance, sch.currency)}</td></tr>
                  {r.note && <tr><th>Note</th><td>{r.note}</td></tr>}
                </tbody>
              </table>
              <div className="doc-foot">
                <div>
                  <div className="muted" style={{ fontSize: 11 }}>Encaissé par</div>
                  <div style={{ fontWeight: 700 }}>{r.recorder_name || 'Secrétariat'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Signature et cachet</div>
                  <div style={{ height: 40 }} />
                </div>
                <div style={{ textAlign: 'right', alignSelf: 'flex-end' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Merci de votre confiance</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
