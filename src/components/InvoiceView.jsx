import { useEffect, useState } from 'react';
import { api, fmt, fmtDate } from '../api';
import { Modal } from '../components';

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
      <div className="print-area doc-page">
        <div className="doc">
          {t && sch && (
            <>
              <div className="doc-header">
                <div>
                  {sch.logo_url && <img className="doc-logo" src={sch.logo_url} alt="logo" />}
                  <div className="doc-school-name">{sch.name}</div>
                  <div className="doc-school-meta">
                    {sch.address && <span>{sch.address}<br /></span>}
                    {sch.phone && <span>Tél : {sch.phone} — </span>}
                    {sch.email && <span>{sch.email}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="doc-receipt-number">FACTURE N° {t.invoice_number}</div>
                  <div className="muted">Date : {fmtDate(t.transaction_date)}</div>
                  <div style={{ marginTop: 8 }} className={`badge ${isEntree ? 'badge-green' : 'badge-red'}`}>
                    {isEntree ? 'ENTRÉE' : 'SORTIE'}
                  </div>
                </div>
              </div>
              <div className="doc-title">{isEntree ? 'Facture d\'entrée d\'argent' : 'Facture de sortie (dépense)'}</div>
              <table className="doc-table">
                <tbody>
                  <tr><th style={{ width: '35%' }}>Libellé</th><td><b>{t.label}</b></td></tr>
                  {t.category && <tr><th>Catégorie</th><td>{t.category}</td></tr>}
                  {t.description && <tr><th>Description</th><td>{t.description}</td></tr>}
                  <tr><th>Montant</th><td><b>{fmt(t.amount, sch.currency)}</b></td></tr>
                  <tr><th>Enregistré par</th><td>{t.recorder_name || 'Secrétariat'}</td></tr>
                </tbody>
              </table>
              <div className="doc-foot">
                <div />
                <div style={{ textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: 11 }}>Signature et cachet</div>
                  <div style={{ height: 40 }} />
                </div>
                <div />
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
