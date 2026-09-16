import { ArrowLeft, Building2, CalendarDays, Clock3, Edit3, Layers3, MapPin, MessageCircle, Trash2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { formatDate } from '../components/OccurrenceCard'
import StatusBadge from '../components/StatusBadge'
import { useOccurrences } from '../context/OccurrencesContext'

export default function OccurrenceDetailsPage() {
  const { id } = useParams()
  const { occurrences } = useOccurrences()
  const occurrence = occurrences.find((item) => item.id === Number(id))

  if (!occurrence) {
    return <div className="page"><div className="empty-state"><h2>Ocorrência não encontrada</h2><Link className="button primary" to="/ocorrencias">Voltar para a lista</Link></div></div>
  }

  return (
    <div className="page details-page">
      <Link className="back-link" to="/ocorrencias"><ArrowLeft size={17} />Voltar para ocorrências</Link>
      <div className="detail-heading">
        <div><span className="eyebrow">Ocorrência #{String(occurrence.id).padStart(3, '0')}</span><h1>{occurrence.descricao}</h1></div>
        <div className="badge-row"><StatusBadge type="type">{occurrence.tipo}</StatusBadge><StatusBadge>{occurrence.status}</StatusBadge></div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="detail-card detail-facts">
            <div><Building2 /><span>Bloco<strong>{occurrence.bloco}</strong></span></div>
            <div><Layers3 /><span>Andar<strong>{occurrence.andar}º</strong></span></div>
            <div><MapPin /><span>Lado<strong>{occurrence.lado}</strong></span></div>
            <div><CalendarDays /><span>Criada em<strong>{formatDate(occurrence.criadoEm)}</strong></span></div>
          </section>

          <section className="detail-card"><span className="eyebrow">Descrição</span><p className="description-copy">{occurrence.descricao}</p></section>

          <section className="detail-card">
            <span className="eyebrow">Histórico de status</span>
            <div className="timeline">
              <div className="timeline-item active"><span /><div><strong>{formatDate(occurrence.criadoEm)}</strong><p>Ocorrência criada como “em aberto”.</p></div></div>
              {occurrence.status !== 'em aberto' && <div className="timeline-item"><span /><div><strong>Status atual</strong><p>Ocorrência marcada como “{occurrence.status}”.</p></div></div>}
            </div>
          </section>
        </div>

        <aside className="actions-card">
          <span className="eyebrow">Ações</span>
          <Link className="button primary full-button" to={`/ocorrencias/${id}/status`}><MessageCircle size={18} />Alterar status</Link>
          <button className="button secondary full-button" disabled title="Aguardando rota de edição no backend"><Edit3 size={18} />Editar ocorrência</button>
          <button className="button danger-outline full-button" disabled title="Aguardando rota de exclusão no backend"><Trash2 size={18} />Excluir ocorrência</button>
          <p className="backend-note">Edição e exclusão ficam prontas para conectar quando as rotas forem adicionadas pelo backend.</p>
        </aside>
      </div>
    </div>
  )
}
