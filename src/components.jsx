export function Modal({ open, onClose, title, children, footer, size }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Stat({ icon, value, label, delta, color = 'bg-primary-light', deltaColor }) {
  return (
    <div className="card stat">
      <div className={`stat-ico ${color}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {delta != null && <div className={`stat-delta ${deltaColor || ''}`}>{delta}</div>}
      </div>
    </div>
  );
}

export function Badge({ kind, children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function Empty({ message = 'Aucune donnée pour le moment' }) {
  return (
    <div className="empty-state">
      <div className="big">🗂</div>
      <div>{message}</div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="empty-state">Chargement…</div>;
}

export function Confirm({ open, title = 'Êtes-vous sûr ?', message, onCancel, onConfirm, confirmLabel = 'Supprimer', danger = true, loading }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal modal-confirm">
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="modal-close" onClick={onCancel} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">{message}</div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>Annuler</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Enveloppe de document réutilisable : en-tête (école), titre, corps, pied de page */
export function DocumentShell({ school, docNumber, docLabel, docKind, kindTone = 'green', date, title, children, footer }) {
  return (
    <div className="print-area doc-page">
      <div className="doc">
        <div className="doc-header">
          <div>
            {school?.logo_url && <img className="doc-logo" src={school.logo_url} alt="logo" />}
            <div className="doc-school-name">{school?.name || 'Établissement'}</div>
            <div className="doc-school-meta">
              {school?.type && `${school.type === 'primaire' ? 'Établissement primaire' : school.type === 'secondaire' ? 'Établissement secondaire' : school.type}`}
              {school?.type && school?.address ? ' — ' : ''}
              {school?.address && <span>{school.address}</span>}
              {school?.address && <br />}
              {school?.phone && <span>Tél : {school.phone} </span>}
              {school?.email && <span>— {school.email}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {docNumber && <div className="doc-receipt-number">{docNumber}</div>}
            <div className="muted">Date : {date}</div>
            {docKind && <div style={{ marginTop: 8 }} className={`badge badge-${kindTone}`}>{docKind}</div>}
          </div>
        </div>
        <div className="doc-title">{title}</div>
        {children}
        {footer}
      </div>
    </div>
  );
}

/* Explication de personnalisation affichée hors impression */
export function DocCustomizeHint() {
  return (
    <div className="card no-print" style={{ marginBottom: 14 }}>
      <b>Personnalisation du document</b>
      <div className="muted" style={{ marginTop: 6 }}>
        Les informations de l'école (nom, logo, adresse, téléphone, e-mail) proviennent des <b>Paramètres</b>.
        Modifiez-les dans <b>Paramètres → École</b> puis re-générez ce document : l'en-tête sera mis à jour automatiquement.
      </div>
    </div>
  );
}
