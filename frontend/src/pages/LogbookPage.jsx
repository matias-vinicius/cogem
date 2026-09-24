import { AlertTriangle, BookOpenText, CalendarDays, Clock3, Plus, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useData } from '../context/DataContext'

function formatDate(value) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export default function LogbookPage() {
  const { logbook, createLogEntry } = useData()
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('todas')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => logbook.filter((item) => (priority === 'todas' || item.priority === priority) && `${item.title} ${item.description} ${item.category} ${item.author}`.toLowerCase().includes(search.toLowerCase())), [logbook, search, priority])
  const today = new Date().toDateString()
  const authors = new Set(logbook.map((item) => item.author)).size
  function submit(event) { event.preventDefault(); createLogEntry(Object.fromEntries(new FormData(event.currentTarget).entries())); setOpen(false) }
  return <div className="page"><PageHeader eyebrow="Portaria" title="Livro da portaria" description="Registre recados, intercorrências e passagens de plantão." action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={17} />Novo registro</button>} />
    <section className="mini-stats"><div><BookOpenText /><span>Registros totais<strong>{logbook.length}</strong></span></div><div><CalendarDays /><span>Movimentações hoje<strong>{logbook.filter((item) => new Date(item.createdAt).toDateString() === today).length}</strong></span></div><div><AlertTriangle /><span>Alertas urgentes<strong>{logbook.filter((item) => item.priority === 'urgente').length}</strong></span></div><div><Users /><span>Agentes em histórico<strong>{authors}</strong></span></div></section>
    <section className="workflow-ribbon"><div className="workflow-intro"><ShieldCheck /><span><small>PLANTÃO DIGITAL</small><strong>Continuidade operacional sem ruído</strong></span></div><div className="workflow-steps"><span className="is-complete"><i>1</i>Registrar</span><span className="is-complete"><i>2</i>Classificar</span><span className="is-current"><i>3</i>Repassar plantão</span><span><i>4</i>Auditar</span></div></section>
    <section className="panel list-panel"><div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar nos registros..." /><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="todas">Todas as prioridades</option><option value="normal">Normal</option><option value="atenção">Atenção</option><option value="urgente">Urgente</option></select></div>
      {filtered.length === 0 ? <EmptyState icon={BookOpenText} /> : <div className="logbook-list">{filtered.map((item) => <article key={item.id} className={`log-entry priority-${item.priority}`}><span className="log-icon">{item.priority === 'urgente' ? <AlertTriangle /> : <BookOpenText />}</span><div className="log-content"><div className="log-heading"><span><Badge>{item.category}</Badge><Badge>{item.priority}</Badge></span><small><Clock3 size={13} />{formatDate(item.createdAt)}</small></div><h3>{item.title}</h3><p>{item.description}</p><footer>Registrado por <strong>{item.author}</strong></footer></div></article>)}</div>}
    </section>
    <Modal open={open} onClose={() => setOpen(false)} title="Novo registro" description="O horário e o responsável serão preenchidos automaticamente." size="large"><form className="form-layout" onSubmit={submit}><label><span>Categoria *</span><select name="category"><option>Troca de turno</option><option>Manutenção</option><option>Segurança</option><option>Entrega</option><option>Recado</option><option>Outro</option></select></label><label><span>Prioridade *</span><select name="priority"><option value="normal">Normal</option><option value="atenção">Atenção</option><option value="urgente">Urgente</option></select></label><label className="span-2"><span>Título *</span><input name="title" required /></label><label className="span-2"><span>Descrição *</span><textarea name="description" rows="6" required /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary">Salvar registro</button></div></form></Modal>
  </div>
}
