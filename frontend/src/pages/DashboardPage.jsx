import { AlertTriangle, ArrowRight, BookOpenText, Boxes, CalendarDays, Clock3, DoorOpen, KeyRound, Package, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { canAccess, ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const activityIcons = { package: Package, access: DoorOpen, occurrence: AlertTriangle, log: BookOpenText, key: KeyRound, visitor: Users, inventory: Boxes, event: CalendarDays }

function formatRelative(value) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value)) / 60000))
  if (diff < 60) return `há ${diff} min`
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`
  return `há ${Math.floor(diff / 1440)}d`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { occurrences, packages, visitors, keys, inventory, activities, events } = useData()
  const pendingOccurrences = occurrences.filter((item) => !['concluída', 'resolvida'].includes(item.status)).length
  const pendingPackages = packages.filter((item) => item.status === 'aguardando retirada').length
  const activeVisitors = visitors.filter((item) => item.status === 'dentro').length
  const lowStock = inventory.filter((item) => item.quantity <= item.minimum).length
  const stats = [
    { module: 'occurrences', icon: AlertTriangle, label: 'Ocorrências ativas', value: pendingOccurrences, helper: `${occurrences.filter((item) => item.type === 'urgente' && !['resolvida', 'concluída'].includes(item.status)).length} urgentes`, tone: 'orange' },
    { module: 'packages', icon: Package, label: 'Encomendas pendentes', value: pendingPackages, helper: `${packages.filter((item) => item.status === 'entregue').length} entregues`, tone: 'blue' },
    { module: 'visitors', icon: Users, label: 'Visitantes no local', value: activeVisitors, helper: `${visitors.filter((item) => item.status === 'autorizado').length} autorizações`, tone: 'green' },
    { module: 'inventory', icon: Boxes, label: 'Itens com estoque baixo', value: lowStock, helper: `${inventory.length} itens cadastrados`, tone: 'red' },
  ].filter((item) => canAccess(user.role, item.module))

  const quickActions = [
    { module: 'occurrences', to: '/ocorrencias', icon: AlertTriangle, label: 'Nova ocorrência' },
    { module: 'packages', to: '/encomendas', icon: Package, label: 'Receber encomenda' },
    { module: 'visitors', to: '/visitantes', icon: Users, label: 'Autorizar visitante' },
    { module: 'logbook', to: '/livro-portaria', icon: BookOpenText, label: 'Registrar no livro' },
  ].filter((item) => canAccess(user.role, item.module))

  return (
    <div className="page dashboard-page">
      <PageHeader eyebrow={`${ROLE_LABELS[user.role]} · ${user.unit}`} title={`Olá, ${user.name.split(' ')[0]}!`} description="Acompanhe agora o que está acontecendo no condomínio." action={canAccess(user.role, 'occurrences') && <Link className="button primary" to="/ocorrencias"><Plus size={17} />Nova ocorrência</Link>} />
      <section className="stats-grid">{stats.map((item) => <StatCard key={item.label} {...item} />)}</section>
      <div className="dashboard-grid">
        <section className="panel activity-panel"><header className="panel-header"><div><span className="eyebrow">Tempo real</span><h2>Atividades recentes</h2></div><Clock3 size={20} /></header><div className="activity-feed">{activities.slice(0, 7).map((activity) => { const Icon = activityIcons[activity.icon] || Clock3; return <article key={activity.id}><span className={`feed-icon feed-${activity.icon}`}><Icon size={17} /></span><div><strong>{activity.title}</strong><p>{activity.description}</p></div><small>{formatRelative(activity.createdAt)}</small></article> })}</div></section>
        <aside className="dashboard-aside">
          <section className="panel quick-panel"><header className="panel-header"><div><span className="eyebrow">Atalhos</span><h2>Ações rápidas</h2></div></header><div className="quick-actions">{quickActions.map(({ to, icon: Icon, label }) => <Link key={label} to={to}><span><Icon size={18} /></span><strong>{label}</strong><ArrowRight size={16} /></Link>)}</div></section>
          <section className="panel operation-panel"><header className="panel-header"><div><span className="eyebrow">Hoje</span><h2>Resumo operacional</h2></div></header><div className="operation-list">{canAccess(user.role, 'keys') && <div><span><KeyRound size={17} />Chaves retiradas</span><strong>{keys.filter((item) => item.status === 'retirada').length}</strong></div>}{canAccess(user.role, 'events') && <div><span><CalendarDays size={17} />Próximas reservas</span><strong>{events.filter((item) => item.status === 'confirmada').length}</strong></div>}{canAccess(user.role, 'occurrences') && <div><span><AlertTriangle size={17} />Em andamento</span><strong>{occurrences.filter((item) => item.status === 'em andamento').length}</strong></div>}</div></section>
        </aside>
      </div>
      {user.role === 'resident' && <section className="resident-summary panel"><div><span className="eyebrow">Minha unidade</span><h2>{user.unit}</h2><p>Acompanhe suas encomendas, autorizações e solicitações.</p></div><div><span>Encomendas <Badge tone="blue">{packages.filter((item) => item.unit === 'A-101' && item.status === 'aguardando retirada').length} pendentes</Badge></span><span>Visitantes <Badge tone="green">{visitors.filter((item) => item.unit === 'A-101' && item.status !== 'finalizado').length} ativos</Badge></span></div></section>}
    </div>
  )
}
