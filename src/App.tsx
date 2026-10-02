import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { configured } from './lib/supabase';
import { useAuth } from './hooks/Auth';
import { Layout } from './components/Layout';
import { Loading } from './components/Shared';
import { AuthFrame, Login, NewPassword } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Schedule } from './pages/Schedule';
import { Payments } from './pages/Payments';

function Protected() {
  const { session, loading, recovery } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (recovery) return <Navigate to="/nova-senha" replace />;
  return <Outlet />;
}
export function App() {
  if (!configured)
    return (
      <AuthFrame>
        <h1>Falta só conectar seu espaço.</h1>
        <p className="muted">
          A configuração inicial ainda não foi concluída. Peça à pessoa responsável pela instalação
          para conectar o Supabase e liberar seu acesso.
        </p>
      </AuthFrame>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-senha" element={<Login reset />} />
        <Route path="/nova-senha" element={<NewPassword />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/funcionarios" element={<Employees />} />
            <Route path="/escala" element={<Schedule />} />
            <Route path="/pagamentos" element={<Payments />} />
            <Route path="/historico" element={<Schedule history />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
