import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context';
import { getToken } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scolarite from './pages/Scolarite';
import Entrees from './pages/Entrees';
import Sorties from './pages/Sorties';
import Balances from './pages/Balances';
import Reports from './pages/Reports';
import Eleves from './pages/Eleves';
import Classes from './pages/Classes';
import Notes from './pages/Notes';
import Parametres from './pages/Parametres';

function Protected({ children }) {
  const { user, loading } = useApp();
  if (loading) return <div className="empty-state">Chargement…</div>;
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/scolarite" element={<Protected><Scolarite /></Protected>} />
          <Route path="/entrees" element={<Protected><Entrees /></Protected>} />
          <Route path="/sorties" element={<Protected><Sorties /></Protected>} />
          <Route path="/balances" element={<Protected><Balances /></Protected>} />
          <Route path="/rapports" element={<Protected><Reports /></Protected>} />
          <Route path="/eleves" element={<Protected><Eleves /></Protected>} />
          <Route path="/classes" element={<Protected><Classes /></Protected>} />
          <Route path="/notes" element={<Protected><Notes /></Protected>} />
          <Route path="/parametres" element={<Protected><Parametres /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
