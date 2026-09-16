import { ArrowLeft, CheckCircle2, Info } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { useOccurrences } from '../context/OccurrencesContext'

const commonStatuses = ['em aberto', 'em andamento', 'concluída', 'incompleta']
const urgentStatuses = ['em aberto', 'resolvida']

export default function ChangeStatusPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { occurrences, changeStatus } = useOccurrences()
  const occurrence = occurrences.find((item) => item.id === Number(id))
  const [selected, setSelected] = useState(occurrence?.status || 'em aberto')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!occurrence) return <div className="page"><div className="empty-state"><h2>Ocorrência não encontrada</h2><Link className="button primary" to="/ocorrencias">Voltar</Link></div></div>

  const options = occurrence.tipo === 'urgente' ? urgentStatuses : commonStatuses

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await changeStatus(id, selected)
      navigate(`/ocorrencias/${id}`)
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível alterar o status.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page status-page">
      <Link className="back-link" to={`/ocorrencias/${id}`}><ArrowLeft size={17} />Voltar aos detalhes</Link>
      <div className="form-card narrow-card">
        <div className="status-title"><span className="status-symbol"><CheckCircle2 /></span><div><span className="eyebrow">Ocorrência #{String(occurrence.id).padStart(3, '0')}</span><h1>Alterar status</h1><p>{occurrence.descricao}</p></div></div>
        <div className="current-status-row"><span>Tipo <StatusBadge type="type">{occurrence.tipo}</StatusBadge></span><span>Status atual <StatusBadge>{occurrence.status}</StatusBadge></span></div>
        <form onSubmit={submit}>
          <fieldset className="status-options"><legend>Selecione o novo status</legend>{options.map((status) => <label key={status} className={`status-option ${selected === status ? 'selected' : ''}`}><input type="radio" name="status" value={status} checked={selected === status} onChange={(event) => setSelected(event.target.value)} /><span>{status}</span></label>)}</fieldset>
          <div className="info-box"><Info size={18} /><p>{occurrence.tipo === 'urgente' ? 'Ocorrências urgentes seguem o fluxo: em aberto → resolvida.' : 'Ocorrências comuns podem passar por atendimento, conclusão ou ficar incompletas.'}</p></div>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary full-button" disabled={saving || selected === occurrence.status}>{saving ? 'Salvando...' : 'Confirmar alteração'}</button>
        </form>
      </div>
    </div>
  )
}
