import { ClipboardList, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import SettingsBackLink from '../components/SettingsBackLink'
import { useOccurrences } from '../context/OccurrencesContext'
import { activityEventName, clearActivityLog, readActivityLog } from '../utils/activityLog'

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function ActivityLogPage() {
  const { occurrences } = useOccurrences()
  const [activities, setActivities] = useState(readActivityLog)

  useEffect(() => {
    const reload = () => setActivities(readActivityLog())
    window.addEventListener(activityEventName, reload)
    return () => window.removeEventListener(activityEventName, reload)
  }, [])

  const initialRecords = useMemo(() => occurrences.map((occurrence) => ({
    id: `occurrence-${occurrence.id}`,
    title: `Ocorrência #${String(occurrence.id).padStart(3, '0')} cadastrada`,
    description: occurrence.descricao,
    createdAt: occurrence.criadoEm,
    type: 'create',
  })), [occurrences])

  const records = [...activities, ...initialRecords]
    .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <div className="page settings-subpage">
      <SettingsBackLink />
      <PageHeader eyebrow="Configurações" title="Registros de atividade" description="Acompanhe cadastros e mudanças realizadas pelo frontend." />
      <section className="activity-card">
        <div className="activity-toolbar"><div><ClipboardList size={20} /><strong>{records.length} registros</strong></div>{activities.length > 0 && <button className="button danger-outline" onClick={clearActivityLog}><Trash2 size={16} />Limpar histórico local</button>}</div>
        {records.length === 0 ? <div className="empty-state"><RotateCcw size={30} /><h3>Nenhuma atividade registrada</h3><p>As próximas ações aparecerão aqui.</p></div> : (
          <div className="activity-list">{records.map((record) => <article key={record.id}><span className={`activity-dot ${record.type || ''}`} /><div><strong>{record.title}</strong><p>{record.description}</p><small>{formatDate(record.createdAt)}</small></div></article>)}</div>
        )}
      </section>
      <p className="local-data-note">Este histórico registra ações feitas neste navegador. Para um histórico compartilhado entre todos os usuários, o backend deverá salvar os eventos no banco.</p>
    </div>
  )
}
