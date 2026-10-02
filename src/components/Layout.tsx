import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, House, Users, Wallet, History, LogOut, Menu, X } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useNotify } from './Feedback';

const links = [
  { to: '/', label: 'Dashboard', icon: House },
  { to: '/escala', label: 'Escala', icon: CalendarDays },
  { to: '/funcionarios', label: 'Funcionários', icon: Users },
  { to: '/pagamentos', label: 'Pagamentos', icon: Wallet },
  { to: '/historico', label: 'Histórico', icon: History },
];
export function Layout() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const notify = useNotify();
  async function logout() {
    setLeaving(true);
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
    } catch {
      notify('Não foi possível sair. Tente novamente.', 'error');
    } finally {
      setLeaving(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <CalendarDays size={24} />
          </span>
          <span>
            escala<span className="brand-subtitle">Sua semana organizada</span>
          </span>
        </NavLink>
        <button
          className="icon-button menu-toggle"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          id="main-navigation"
          className={open ? 'navigation open' : 'navigation'}
          aria-label="Menu principal"
        >
          <span className="nav-caption">DIA A DIA</span>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
          <button className="nav-link logout" disabled={leaving} onClick={logout}>
            <LogOut size={20} />
            {leaving ? 'Saindo…' : 'Sair'}
          </button>
        </nav>
        <div className="sidebar-note">
          Uma semana de cada vez.
          <br />
          Tudo no seu lugar.
        </div>
      </aside>
      <div className="main-shell">
        <div className="topbar">
          <span>Escalas e diárias</span>
          <span className="topbar-note">
            <span className="status-dot" />
            Seu espaço de trabalho
          </span>
        </div>
        <main id="main-content">
          <Outlet />
        </main>
        <footer>Simples de organizar. Fácil de acompanhar.</footer>
      </div>
    </div>
  );
}
