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
