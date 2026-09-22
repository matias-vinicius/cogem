import { AlertTriangle, CheckCircle2, CircleDot, Clock3, Plus, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const nextStatuses = {
  comum: { 'em aberto': ['em andamento'], 'em andamento': ['concluída', 'incompleta'], incompleta: ['em andamento'], concluída: [] },
  urgente: { 'em aberto': ['em andamento'], 'em andamento': ['resolvida'], resolvida: [] },
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default function OccurrencesPage() {
  const { user } = useAuth()
  const { occurrences, createOccurrence, updateOccurrenceStatus } = useData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todos')
  const [type, setType] = useState('todos')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)

  const visibleOccurrences = user.role === 'resident' ? occurrences.filter((item) => item.reporter === user.name) : occurrences
  const filtered = useMemo(() => visibleOccurrences.filter((item) => {
    const query = search.toLowerCase()
    return (!query || `${item.title} ${item.description} ${item.block} ${item.reporter}`.toLowerCase().includes(query)) && (status === 'todos' || item.status === status) && (type === 'todos' || item.type === type)
  }), [visibleOccurrences, search, status, type])

  function submitOccurrence(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createOccurrence({ title: form.get('title'), description: form.get('description'), block: form.get('block'), floor: Number(form.get('floor')), side: form.get('side'), type: form.get('type') })
    setModal(null)
  }

  function openStatus(item) { setSelected(item); setModal('status') }
  function changeStatus(next) { updateOccurrenceStatus(selected.id, next); setModal(null); setSelected(null) }

  const active = visibleOccurrences.filter((item) => !['concluída', 'resolvida'].includes(item.status)).length

  return (
    <div className="page">
      <PageHeader eyebrow="Operação" title="Ocorrências" description="Registre, acompanhe e conclua solicitações do condomínio." action={<button className="button primary" onClick={() => setModal('new')}><Plus size={17} />Nova ocorrência</button>} />
      <section className="mini-stats"><div><CircleDot /><span>Em aberto<strong>{visibleOccurrences.filter((item) => item.status === 'em aberto').length}</strong></span></div><div><Wrench /><span>Em andamento<strong>{visibleOccurrences.filter((item) => item.status === 'em andamento').length}</strong></span></div><div><AlertTriangle /><span>Urgentes<strong>{visibleOccurrences.filter((item) => item.type === 'urgente' && !['resolvida', 'concluída'].includes(item.status)).length}</strong></span></div><div><CheckCircle2 /><span>Finalizadas<strong>{visibleOccurrences.length - active}</strong></span></div></section>
      <section className="panel list-panel">
        <div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar por descrição, bloco ou responsável..." /><select value={type} onChange={(event) => setType(event.target.value)}><option value="todos">Todos os tipos</option><option value="comum">Comum</option><option value="urgente">Urgente</option></select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos os status</option><option>em aberto</option><option>em andamento</option><option>concluída</option><option>incompleta</option><option>resolvida</option></select></div>
        {filtered.length === 0 ? <EmptyState icon={AlertTriangle} /> : <div className="responsive-table"><table><thead><tr><th>ID</th><th>Ocorrência</th><th>Local</th><th>Tipo</th><th>Status</th><th>Atualização</th><th>Ação</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td data-label="ID">#{String(item.id).padStart(3, '0')}</td><td data-label="Ocorrência"><strong>{item.title}</strong><small>{item.reporter}</small></td><td data-label="Local">Bloco {item.block} · {item.floor}º</td><td data-label="Tipo"><Badge>{item.type}</Badge></td><td data-label="Status"><Badge>{item.status}</Badge></td><td data-label="Atualização"><span className="date-cell"><Clock3 size={14} />{formatDate(item.updatedAt)}</span></td><td data-label="Ação">{(nextStatuses[item.type]?.[item.status] || []).length ? <button className="table-button" onClick={() => openStatus(item)}>Alterar status</button> : <span className="done-label"><CheckCircle2 size={15} />Finalizada</span>}</td></tr>)}</tbody></table></div>}
      </section>

      <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Nova ocorrência" description="A solicitação será criada automaticamente como em aberto." size="large"><form className="form-layout" onSubmit={submitOccurrence}><label className="span-2"><span>Título *</span><input name="title" required minLength="5" placeholder="Ex.: Detector com defeito" /></label><label><span>Bloco *</span><select name="block"><option>A</option><option>B</option><option>C</option><option>D</option></select></label><label><span>Andar *</span><input name="floor" type="number" min="0" max="99" required /></label><label><span>Lado *</span><select name="side"><option>A</option><option>B</option><option>C</option></select></label><label><span>Tipo *</span><select name="type"><option value="comum">Comum</option><option value="urgente">Urgente</option></select></label><label className="span-2"><span>Descrição *</span><textarea name="description" rows="5" required minLength="5" placeholder="Descreva o problema e o local com detalhes..." /></label><div className="form-info span-2"><CircleDot size={17} /><span><strong>Status inicial: Em aberto</strong>O atendimento deverá ser iniciado posteriormente.</span></div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Cadastrar ocorrência</button></div></form></Modal>

      <Modal open={modal === 'status'} onClose={() => setModal(null)} title="Alterar status" description={selected?.title}>{selected && <div className="status-change"><div className="current-status"><span>Status atual</span><Badge>{selected.status}</Badge></div><p>Selecione a próxima etapa permitida:</p><div className="status-choice">{(nextStatuses[selected.type]?.[selected.status] || []).map((next) => <button key={next} onClick={() => changeStatus(next)}><span className={`choice-icon choice-${next.replace(' ', '-')}`}>{next === 'em andamento' ? <Wrench /> : <CheckCircle2 />}</span><strong>{next}</strong></button>)}</div></div>}</Modal>
    </div>
  )
}
