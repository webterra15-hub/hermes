import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { Modal, DocumentShell, DocCustomizeHint } from '../components';

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
      <DocCustomizeHint />
      <DocumentShell
        school={sch}
        docNumber={`REÇU N° ${r?.receipt_number}`}
        docKind={r?.category ? r.category.toUpperCase() : 'SCOLARITÉ'}
        kindTone="green"
        date={fmtDate(r?.payment_date)}
        title="Reçu de paiement"
        footer={r && (
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
        )}>
        {r && sch && (
          <table className="doc-table">
            <tbody>
              <tr><th style={{ width: '35%' }}>Élève</th><td><b>{r.first_name} {r.last_name}</b></td></tr>
              <tr><th>Classe</th><td>{r.class_name} ({r.level_name}) — Année {r.year_label}</td></tr>
              {r.parent_name && <tr><th>Parent / Tuteur</th><td>{r.parent_name}</td></tr>}
              <tr><th>Montant payé</th><td><b>{fmt(r.amount, sch.currency)}</b> — Espèces</td></tr>
              <tr><th>Scolarité annuelle</th><td>{fmt(r.tuition_fee, sch.currency)}</td></tr>
              <tr><th>Total payé à ce jour</th><td>{fmt(data.stats?.paid, sch.currency)}</td></tr>
              <tr><th>Reste à payer</th><td>{fmt(data.stats?.balance, sch.currency)}</td></tr>
              {r.note && <tr><th>Note</th><td>{r.note}</td></tr>}
            </tbody>
          </table>
        )}
      </DocumentShell>
    </Modal>
  );
}
