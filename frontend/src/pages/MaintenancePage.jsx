import { CalendarCheck, CheckCircle2, CircleDot, Clock3, Plus, ShieldCheck, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import DemoBanner from '../components/DemoBanner'
import { useData } from '../context/DataContext'

const date = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const nextStatus = { aberta: 'em andamento', agendada: 'em andamento', 'em andamento': 'concluída', concluída: 'concluída' }

export default function MaintenancePage() {
  const { workOrders, createWorkOrder, updateWorkOrderStatus } = useData()
  const [modal, setModal] = useState(false)
  const [filter, setFilter] = useState('todas')
  const list = useMemo(() => workOrders.filter((item) => filter === 'todas' || item.status === filter), [workOrders, filter])
  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createWorkOrder(Object.fromEntries(form))
    setModal(false)
  }
  return <div className="page">
    <PageHeader eyebrow="Manutenção inteligente" title="Ordens de serviço" description="Planeje preventivas, acompanhe corretivas e mantenha o patrimônio auditável." action={<button className="button primary" onClick={() => setModal(true)}><Plus />Nova ordem</button>} />
    <DemoBanner title="Ordens de serviço e planos preventivos estão em avaliação" />
    <section className="suite-stats"><div><Wrench /><span><small>Ordens abertas</small><strong>{workOrders.filter((item) => item.status !== 'concluída').length}</strong></span></div><div><CalendarCheck /><span><small>Preventivas</small><strong>{workOrders.filter((item) => item.type === 'preventiva').length}</strong></span></div><div><Clock3 /><span><small>Em andamento</small><strong>{workOrders.filter((item) => item.status === 'em andamento').length}</strong></span></div><div><ShieldCheck /><span><small>Conformidade</small><strong>94%</strong></span></div></section>
    <section className="panel"><div className="list-toolbar"><div className="tabs">{['todas', 'aberta', 'agendada', 'em andamento', 'concluída'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div></div><div className="work-order-grid">{list.map((item) => <article key={item.id}><header><span className="suite-icon"><Wrench /></span><div><small>{item.protocol}</small><h3>{item.title}</h3></div><Badge>{item.status}</Badge></header><p>{item.description}</p><div className="work-meta"><span><CircleDot />{item.type} · {item.priority}</span><span><CalendarCheck />Prazo: {date(item.dueAt)}</span><span><Wrench />{item.location}</span></div><footer><div><small>Responsável</small><strong>{item.assignedTo}</strong></div>{item.status !== 'concluída' && <button className="button primary" onClick={() => updateWorkOrderStatus(item.id, nextStatus[item.status])}>{nextStatus[item.status] === 'concluída' ? <CheckCircle2 /> : <Clock3 />}{nextStatus[item.status]}</button>}</footer></article>)}</div></section>
    <Modal open={modal} onClose={() => setModal(false)} title="Nova ordem de serviço" size="large"><form className="form-layout" onSubmit={submit}><label className="span-2"><span>Título *</span><input name="title" required /></label><label><span>Tipo</span><select name="type"><option>preventiva</option><option>corretiva</option><option>inspeção</option></select></label><label><span>Prioridade</span><select name="priority"><option>baixa</option><option>média</option><option>alta</option><option>crítica</option></select></label><label><span>Categoria</span><input name="category" required placeholder="Elétrica, portões..." /></label><label><span>Local</span><input name="location" required /></label><label><span>Responsável</span><input name="assignedTo" required /></label><label><span>Prazo</span><input name="dueAt" type="datetime-local" required /></label><label className="span-2"><span>Descrição</span><textarea name="description" required /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(false)}>Cancelar</button><button className="button primary">Abrir ordem</button></div></form></Modal>
  </div>
}
