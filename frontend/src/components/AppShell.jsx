import {
  Building2,
  CircleUserRound,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Plus,
  Settings,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useOccurrences } from '../context/OccurrencesContext'

const navItems = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/ocorrencias', label: 'Ocorrências', icon: ClipboardList },
  { to: '/ocorrencias/nova', label: 'Nova ocorrência', icon: Plus },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark"><Building2 size={26} /></span>
      <span><strong>COGEM</strong><small>Gestão de Ocorrências em Condomínios</small></span>
    </div>
  )
}

export default function AppShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { apiError } = useOccurrences()
  const location = useLocation()

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />
        <div className="topbar-actions">
          {apiError && <span className="demo-pill error">API desconectada</span>}
          <div className="profile-chip"><CircleUserRound size={20} /><span>Administrador</span></div>
          <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Abrir menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <nav aria-label="Navegação principal">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={closeMenu} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="sidebar-logout"><LogOut size={19} />Sair</button>
      </aside>

      {menuOpen && <button className="menu-backdrop" onClick={closeMenu} aria-label="Fechar menu" />}

      <main key={location.pathname} className="page-content">{children}</main>

      <nav className="bottom-nav" aria-label="Navegação móvel">
        {navItems.filter((item) => item.to !== '/ocorrencias/nova').map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={20} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
