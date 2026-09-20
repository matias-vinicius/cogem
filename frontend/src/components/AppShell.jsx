import {
  Bell, BookOpenText, Boxes, Building2, CalendarDays, ChevronDown, ClipboardList,
  DoorOpen, HelpCircle, Home, KeyRound, LogOut, Menu, Package, Settings, ShieldCheck, UserRound, Users, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { canAccess, ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const navigation = [
  { label: 'Visão geral', items: [{ to: '/', label: 'Início', icon: Home, module: 'dashboard', end: true }] },
  { label: 'Operação', items: [
    { to: '/ocorrencias', label: 'Ocorrências', icon: ClipboardList, module: 'occurrences' },
    { to: '/encomendas', label: 'Encomendas', icon: Package, module: 'packages' },
    { to: '/livro-portaria', label: 'Livro da portaria', icon: BookOpenText, module: 'logbook' },
    { to: '/chaves', label: 'Chaves', icon: KeyRound, module: 'keys' },
    { to: '/visitantes', label: 'Visitantes', icon: Users, module: 'visitors' },
    { to: '/controle-acesso', label: 'Controle de acesso', icon: DoorOpen, module: 'access' },
  ] },
  { label: 'Gestão', items: [
    { to: '/estoque', label: 'Estoque', icon: Boxes, module: 'inventory' },
    { to: '/reservas', label: 'Reservas e eventos', icon: CalendarDays, module: 'events' },
    { to: '/usuarios', label: 'Usuários e acessos', icon: ShieldCheck, module: 'users' },
    { to: '/configuracoes', label: 'Configurações', icon: Settings, module: 'settings' },
  ] },
]

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const { packages, visitors, occurrences } = useData()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setMenuOpen(false); setProfileOpen(false); setNotificationOpen(false) }, [location.pathname])

  const alerts = useMemo(() => (
    packages.filter((item) => item.status === 'aguardando retirada').length +
    visitors.filter((item) => item.status === 'dentro').length +
    occurrences.filter((item) => item.status === 'em aberto').length
  ), [packages, visitors, occurrences])

  const visibleGroups = navigation.map((group) => ({ ...group, items: group.items.filter((item) => canAccess(user.role, item.module)) })).filter((group) => group.items.length)

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
        <div className="topbar-context"><span className="topbar-property"><Building2 size={17} />Residencial COGEM</span></div>
        <div className="topbar-actions">
          <div className="notification-menu"><button className="notification-button" onClick={() => { setNotificationOpen((value) => !value); setProfileOpen(false) }} aria-label={`${alerts} alertas`}><Bell size={19} />{alerts > 0 && <span>{alerts > 9 ? '9+' : alerts}</span>}</button>{notificationOpen && <div className="notification-dropdown"><header><strong>Central de alertas</strong><small>{alerts} pendência(s)</small></header>{canAccess(user.role, 'packages') && <NavLink to="/encomendas"><Package size={17} /><span><strong>Encomendas</strong><small>{packages.filter((item) => item.status === 'aguardando retirada').length} aguardando retirada</small></span></NavLink>}{canAccess(user.role, 'visitors') && <NavLink to="/visitantes"><Users size={17} /><span><strong>Visitantes</strong><small>{visitors.filter((item) => item.status === 'dentro').length} dentro do condomínio</small></span></NavLink>}{canAccess(user.role, 'occurrences') && <NavLink to="/ocorrencias"><ClipboardList size={17} /><span><strong>Ocorrências</strong><small>{occurrences.filter((item) => item.status === 'em aberto').length} em aberto</small></span></NavLink>}</div>}</div>
          <div className="profile-menu">
            <button className="profile-trigger" onClick={() => { setProfileOpen((value) => !value); setNotificationOpen(false) }}><span className="avatar-small">{user.name.charAt(0)}</span><span><strong>{user.name}</strong><small>{ROLE_LABELS[user.role]}</small></span><ChevronDown size={15} /></button>
            {profileOpen && <div className="profile-dropdown"><div><strong>{user.email}</strong><small>{user.unit}</small></div><NavLink to="/perfil"><UserRound size={16} />Meu perfil</NavLink><NavLink to="/ajuda"><HelpCircle size={16} />Ajuda e suporte</NavLink><button onClick={logout}><LogOut size={16} />Sair do sistema</button></div>}
          </div>
        </div>
      </header>

      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><span className="brand-mark"><Building2 size={27} /></span><span><strong>COGEM</strong><small>Gestão condominial</small></span><button className="sidebar-close" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <nav className="sidebar-nav">
          {visibleGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18} /><span>{label}</span>{to === '/encomendas' && packages.filter((item) => item.status === 'aguardando retirada').length > 0 && <b>{packages.filter((item) => item.status === 'aguardando retirada').length}</b>}</NavLink>)}</div>)}
        </nav>
        <div className="sidebar-footer"><span className="system-status"><i />Sistema operacional</span><small>COGEM v1.0</small></div>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <main className="page-content">{children}</main>
    </div>
  )
}
