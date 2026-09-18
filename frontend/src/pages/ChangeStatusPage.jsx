import { ArrowLeft, CheckCircle2, Info } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { useOccurrences } from '../context/OccurrencesContext'

const transitions = {
  comum: {
    'em aberto': ['em andamento'],
    'em andamento': ['concluída', 'incompleta'],
    incompleta: ['em andamento'],
    concluída: [],
  },
  urgente: {
    'em aberto': ['em andamento'],
    'em andamento': ['resolvida'],
    resolvida: [],
  },
}

export default function ChangeStatusPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { occurrences, changeStatus } = useOccurrences()
  const occurrence = occurrences.find((item) => item.id === Number(id))
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!occurrence) return <div className="page"><div className="empty-state"><h2>Ocorrência não encontrada</h2><Link className="button primary" to="/ocorrencias">Voltar</Link></div></div>

  const options = transitions[occurrence.tipo]?.[occurrence.status] || []

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
          {options.length > 0 ? <fieldset className="status-options"><legend>Selecione o próximo status</legend>{options.map((status) => <label key={status} className={`status-option ${selected === status ? 'selected' : ''}`}><input type="radio" name="status" value={status} checked={selected === status} onChange={(event) => setSelected(event.target.value)} /><span>{status}</span></label>)}</fieldset> : <div className="terminal-status"><CheckCircle2 size={26} /><strong>Fluxo finalizado</strong><p>Esta ocorrência chegou ao status final e não possui novas etapas.</p></div>}
          <div className="info-box"><Info size={18} /><p>{occurrence.tipo === 'urgente' ? 'Fluxo urgente: em aberto → em andamento → resolvida.' : 'Fluxo comum: em aberto → em andamento → concluída ou incompleta.'}</p></div>
          {error && <p className="form-error">{error}</p>}
          {options.length > 0 && <button className="button primary full-button" disabled={saving || !selected}>{saving ? 'Salvando...' : 'Confirmar alteração'}</button>}
        </form>
      </div>
    </div>
  )
}
