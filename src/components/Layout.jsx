import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { ROLE_LABELS } from '../api';

const NAV = [
  {
    section: 'Vue d\'ensemble',
    items: [{ to: '/', label: 'Tableau de bord', icon: '📊', exact: true }]
  },
  {
    section: 'Finances',
    items: [
      { to: '/scolarite', label: 'Scolarité & Paiements', icon: '🎓' },
      { to: '/entrees', label: 'Entrées', icon: '📥' },
      { to: '/sorties', label: 'Sorties & Dépenses', icon: '📤' },
      { to: '/balances', label: 'Balances', icon: '⚖️' },
      { to: '/rapports', label: 'Rapports financiers', icon: '📊' }
    ]
  },
  {
    section: 'Administration',
    items: [
      { to: '/eleves', label: 'Élèves & Inscriptions', icon: '🧑‍🎓' },
      { to: '/classes', label: 'Classes & Niveaux', icon: '🏫' },
      { to: '/notes', label: 'Notes & Bulletins', icon: '📝' }
    ]
  },
  {
    section: 'Configuration',
    items: [
      { to: '/parametres', label: 'Paramètres', icon: '⚙️' }
    ]
  }
];

const TITLES = {
  '/': 'Tableau de bord',
  '/scolarite': 'Scolarité & Paiements',
  '/entrees': 'Entrées d\'argent',
  '/sorties': 'Sorties & Dépenses',
  '/balances': 'Balances financières',
  '/rapports': 'Rapports financiers',
  '/eleves': 'Élèves & Inscriptions',
  '/classes': 'Classes & Niveaux',
  '/notes': 'Notes & Bulletins',
  '/parametres': 'Paramètres'
};

export default function Layout({ children }) {
  const { user, school, year, logout } = useApp();
  const navigate = useNavigate();
  const initials = (user?.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const path = window.location.pathname;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo-badge">E</div>
          <div>
            <div className="brand-name">edumanager</div>
            <div className="brand-sub">Gestion scolaire</div>
          </div>
        </div>
        <div className="sidebar-school">
          <div className="school-name">{school?.name || 'Établissement'}</div>
          <div>{year?.label}</div>
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
          {NAV.map(group => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-ico">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>v1.0</span>
          <button className="btn-ghost btn btn-sm" onClick={logout}>Déconnexion</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="page-title">{TITLES[path] || 'edumanager'}</div>
          <div className="row">
            <span className="year-badge">{year?.label}</span>
            <div className="user-chip">
              <div className="avatar">{initials}</div>
              <div className="user-meta">
                <div className="user-name">{user?.full_name}</div>
                <div className="user-role">{ROLE_LABELS[user?.role]}</div>
              </div>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
