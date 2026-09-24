import {
  AlertTriangle, ArrowRight, BookOpenText, Boxes, CalendarDays, CarFront, CheckCircle2,
  ChevronRight, Clock3, DoorOpen, KeyRound, Megaphone, Package, Plus, ReceiptText,
  ShieldCheck, Users, Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { canAccess, ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const activityIcons = {
  package: Package, access: DoorOpen, occurrence: AlertTriangle, log: BookOpenText,
  key: KeyRound, visitor: Users, vehicle: CarFront, inventory: Boxes,
  event: CalendarDays, announcement: Megaphone, maintenance: Wrench,
}

const movement = [
  { day: 'Seg', accesses: 36, packages: 12, occurrences: 5 },
  { day: 'Ter', accesses: 29, packages: 16, occurrences: 7 },
  { day: 'Qua', accesses: 42, packages: 21, occurrences: 9 },
  { day: 'Qui', accesses: 45, packages: 18, occurrences: 8 },
  { day: 'Sex', accesses: 54, packages: 25, occurrences: 11 },
  { day: 'Sáb', accesses: 43, packages: 17, occurrences: 9 },
  { day: 'Dom', accesses: 51, packages: 22, occurrences: 7 },
]

function formatRelative(value) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value)) / 60000))
  if (diff < 60) return `há ${diff} min`
  if (diff < 1440) return `há ${Math.floor(diff / 60)}h`
  return `há ${Math.floor(diff / 1440)}d`
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { occurrences, packages, visitors, vehicles, inventory, activities, events, workOrders, charges } = useData()

  const pendingOccurrences = occurrences.filter((item) => !['concluída', 'resolvida'].includes(item.status)).length
  const pendingPackages = packages.filter((item) => item.status === 'aguardando retirada').length
  const activeVisitors = visitors.filter((item) => item.status === 'dentro').length
  const lowStock = inventory.filter((item) => item.quantity <= item.minimum).length

  const stats = [
    { module: 'occurrences', icon: AlertTriangle, label: 'Ocorrências abertas', value: pendingOccurrences, helper: `${occurrences.filter((item) => item.type === 'urgente' && !['resolvida', 'concluída'].includes(item.status)).length} urgentes`, tone: 'blue' },
    { module: 'packages', icon: Package, label: 'Encomendas aguardando', value: pendingPackages, helper: `${packages.filter((item) => item.status === 'entregue').length} entregues`, tone: 'orange' },
    { module: 'visitors', icon: Users, label: 'Visitantes no condomínio', value: activeVisitors, helper: `${visitors.filter((item) => item.status === 'autorizado').length} autorizados`, tone: 'green' },
    { module: 'vehicles', icon: CarFront, label: 'Veículos no local', value: vehicles.filter((item) => item.status === 'dentro').length, helper: `${vehicles.length} cadastrados`, tone: 'purple' },
    { module: 'inventory', icon: Boxes, label: 'Alertas de estoque', value: lowStock, helper: `${inventory.length} itens cadastrados`, tone: 'red' },
    { module: 'maintenanceHub', icon: Wrench, label: 'Ordens em andamento', value: workOrders.filter((item) => item.status !== 'concluída').length, helper: `${workOrders.filter((item) => item.status === 'em andamento').length} em execução`, tone: 'orange' },
    { module: 'finance', icon: ReceiptText, label: 'Cobranças vencidas', value: charges.filter((item) => item.status === 'vencido').length, helper: `${charges.length} cobranças`, tone: 'red' },
  ].filter((item) => canAccess(user.role, item.module)).slice(0, 4)

  const quickActions = [
    { module: 'packages', to: '/encomendas', icon: Package, label: 'Nova encomenda', tone: 'blue' },
    { module: 'visitors', to: '/visitantes', icon: Users, label: 'Autorizar visitante', tone: 'green' },
    { module: 'occurrences', to: '/ocorrencias', icon: AlertTriangle, label: 'Abrir ocorrência', tone: 'red' },
    { module: 'access', to: '/controle-acesso', icon: CarFront, label: 'Registrar acesso', tone: 'purple' },
    { module: 'logbook', to: '/livro-portaria', icon: BookOpenText, label: 'Livro da portaria', tone: 'blue' },
    { module: 'maintenanceHub', to: '/manutencao', icon: Wrench, label: 'Nova ordem de serviço', tone: 'orange' },
  ].filter((item) => canAccess(user.role, item.module)).slice(0, 4)

  const operationItems = [
    { module: 'access', icon: ShieldCheck, title: 'Portaria online', description: 'Entradas monitoradas normalmente', status: 'Online', tone: 'green' },
    { module: 'maintenanceHub', icon: Wrench, title: `${workOrders.filter((item) => item.status !== 'concluída').length} ordens em andamento`, description: 'Manutenção e serviços ativos', tone: 'blue' },
    { module: 'events', icon: CalendarDays, title: `${events.filter((item) => item.status === 'confirmada').length} reservas confirmadas`, description: 'Áreas comuns programadas', tone: 'blue' },
    { module: 'inventory', icon: Boxes, title: `Estoque com ${lowStock} alerta${lowStock === 1 ? '' : 's'}`, description: 'Itens abaixo do saldo mínimo', status: lowStock ? `${lowStock} alertas` : 'Regular', tone: lowStock ? 'red' : 'green' },
    { module: 'finance', icon: ReceiptText, title: `${charges.filter((item) => item.status === 'vencido').length} cobranças vencidas`, description: 'Acompanhamento exclusivo do síndico', tone: 'orange' },
  ].filter((item) => canAccess(user.role, item.module)).slice(0, 4)

  return (
    <div className="page dashboard-page">
      <PageHeader eyebrow={`${ROLE_LABELS[user.role]} · Administração`} title={`Olá, ${user.name.split(' ')[0]}!`} description="Acompanhe tudo o que acontece no condomínio em tempo real." action={canAccess(user.role, 'occurrences') && <Link className="button primary" to="/ocorrencias"><Plus size={17} />Nova ocorrência</Link>} />

      <section className="stats-grid dashboard-stats">{stats.map((item) => <StatCard key={item.label} {...item} />)}</section>

      <section className="dashboard-command-grid">
        <article className="panel movement-panel">
          <header className="panel-header compact-panel-header"><div><span className="eyebrow">Visão operacional</span><h2>Movimentação do condomínio</h2></div><span className="period-pill"><CalendarDays size={15} />Últimos 7 dias</span></header>
          <div className="movement-chart" role="img" aria-label="Comparativo de acessos, encomendas e ocorrências nos últimos sete dias">{movement.map((item) => <div className="movement-column" key={item.day}><div className="movement-bars"><i className="bar-access" style={{ height: `${item.accesses * 1.45}px` }} /><i className="bar-package" style={{ height: `${item.packages * 2.2}px` }} /><i className="bar-occurrence" style={{ height: `${item.occurrences * 3.2}px` }} /></div><small>{item.day}</small></div>)}</div>
          <footer className="chart-legend"><span><i className="legend-access" />Acessos</span><span><i className="legend-package" />Encomendas</span><span><i className="legend-occurrence" />Ocorrências</span></footer>
        </article>

        <article className="panel operation-now-panel">
          <header className="panel-header compact-panel-header"><div><span className="eyebrow">Tempo real</span><h2>Operação agora</h2></div><span className="live-indicator"><i />Sistema normal</span></header>
          <div className="operation-now-list">{operationItems.map(({ icon: Icon, title, description, status, tone }) => <div key={title}><span className={`operation-icon tone-${tone}`}><Icon size={18} /></span><span><strong>{title}</strong><small>{description}</small></span>{status ? <em className={`operation-status status-${tone}`}>{status}</em> : <ChevronRight size={17} />}</div>)}</div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="panel activity-panel"><header className="panel-header compact-panel-header"><div><span className="eyebrow">Atualizações</span><h2>Atividades recentes</h2></div><Clock3 size={19} /></header><div className="activity-feed">{activities.slice(0, 5).map((activity) => { const Icon = activityIcons[activity.icon] || Clock3; return <article key={activity.id}><span className={`feed-icon feed-${activity.icon}`}><Icon size={17} /></span><div><strong>{activity.title}</strong><p>{activity.description}</p></div><small>{formatRelative(activity.createdAt)}</small></article> })}</div></article>

        <article className="panel quick-panel"><header className="panel-header compact-panel-header"><div><span className="eyebrow">Atalhos</span><h2>Acessos rápidos</h2></div></header><div className="quick-action-grid">{quickActions.map(({ to, icon: Icon, label, tone }) => <Link className={`quick-action tone-${tone}`} key={label} to={to}><span><Icon size={20} /></span><strong>{label}</strong><ArrowRight size={16} /></Link>)}</div></article>
      </section>

      {user.role === 'resident' && <section className="resident-summary panel"><div><span className="eyebrow">Minha unidade</span><h2>{user.unit}</h2><p>Acompanhe exclusivamente suas encomendas e ocorrências.</p></div><CheckCircle2 size={24} /></section>}
    </div>
  )
}
