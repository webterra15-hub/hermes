import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { Modal, DocumentShell } from '../components';

export default function InvoiceView({ transaction, onClose, kindLabel }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (transaction) {
      api.get(`/transactions/${transaction.id}`).then(d => setData(d)).catch(() => setData(null));
    } else setData(null);
  }, [transaction]);

  if (!transaction) return null;
  const t = data?.transaction;
  const sch = data?.school;
  const isEntree = t?.type === 'entree';

  return (
    <Modal open onClose={onClose} title={isEntree ? 'Facture d\'entrée' : 'Facture de sortie'} size="lg"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Imprimer / PDF</button>
        </>
      }>
      <DocumentShell
        school={sch}
        docNumber={`FACTURE N° ${t?.invoice_number}`}
        docKind={isEntree ? 'ENTRÉE' : 'SORTIE'}
        kindTone={isEntree ? 'green' : 'red'}
        date={fmtDate(t?.transaction_date)}
        title={isEntree ? 'Facture d\'entrée d\'argent' : 'Facture de sortie (dépense)'}
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
        {t && sch && (
          <table className="doc-table">
            <tbody>
              <tr><th style={{ width: '35%' }}>Libellé</th><td><b>{t.label}</b></td></tr>
              {t.category && <tr><th>Catégorie</th><td>{t.category}</td></tr>}
              {t.description && <tr><th>Description</th><td>{t.description}</td></tr>}
              <tr><th>Montant</th><td><b>{fmt(t.amount, sch.currency)}</b></td></tr>
              <tr><th>Enregistré par</th><td>{t.recorder_name || 'Secrétariat'}</td></tr>
            </tbody>
          </table>
        )}
      </DocumentShell>
    </Modal>
  );
}
