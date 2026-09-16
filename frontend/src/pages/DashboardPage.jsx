import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, Clock3, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import OccurrenceCard from '../components/OccurrenceCard'
import PageHeader from '../components/PageHeader'
import { useOccurrences } from '../context/OccurrencesContext'

export default function DashboardPage() {
  const { occurrences } = useOccurrences()
  const counts = {
    total: occurrences.length,
    aberto: occurrences.filter((item) => item.status === 'em aberto').length,
    andamento: occurrences.filter((item) => item.status === 'em andamento').length,
    resolvidas: occurrences.filter((item) => ['concluída', 'resolvida'].includes(item.status)).length,
  }

  const cards = [
    { label: 'Total de ocorrências', value: counts.total, icon: ClipboardList, tone: 'blue' },
    { label: 'Em aberto', value: counts.aberto, icon: AlertCircle, tone: 'amber' },
    { label: 'Em andamento', value: counts.andamento, icon: Clock3, tone: 'sky' },
    { label: 'Resolvidas', value: counts.resolvidas, icon: CheckCircle2, tone: 'green' },
  ]

  return (
    <div className="page dashboard-page">
      <PageHeader
        eyebrow="Visão geral"
        title="Olá, Administrador!"
        description="Acompanhe e gerencie as ocorrências do condomínio em um só lugar."
        action={<Link className="button primary" to="/ocorrencias/nova"><Plus size={18} />Nova ocorrência</Link>}
      />

      <section className="stats-grid" aria-label="Resumo das ocorrências">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article className={`stat-card tone-${tone}`} key={label}>
            <span className="stat-icon"><Icon size={21} /></span>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">Atualizações</span><h2>Ocorrências recentes</h2></div>
          <Link className="text-link" to="/ocorrencias">Ver todas <ArrowRight size={16} /></Link>
        </div>
        <div className="cards-list compact-cards">
          {occurrences.slice(0, 4).map((item) => <OccurrenceCard occurrence={item} key={item.id} />)}
        </div>
      </section>
    </div>
  )
}
