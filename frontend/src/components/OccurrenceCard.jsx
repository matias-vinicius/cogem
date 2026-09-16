import { CalendarDays, ChevronRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from './StatusBadge'

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export default function OccurrenceCard({ occurrence }) {
  return (
    <Link className="occurrence-card" to={`/ocorrencias/${occurrence.id}`}>
      <div className="occurrence-card-top">
        <strong>#{String(occurrence.id).padStart(3, '0')}</strong>
        <div className="badge-row">
          <StatusBadge type="type">{occurrence.tipo}</StatusBadge>
          <StatusBadge>{occurrence.status}</StatusBadge>
        </div>
      </div>
      <h3>{occurrence.descricao}</h3>
      <div className="occurrence-card-meta">
        <span><MapPin size={14} />Bloco {occurrence.bloco} · {occurrence.andar}º · Lado {occurrence.lado}</span>
        <span><CalendarDays size={14} />{formatDate(occurrence.criadoEm)}</span>
      </div>
      <ChevronRight className="card-chevron" size={20} />
    </Link>
  )
}
