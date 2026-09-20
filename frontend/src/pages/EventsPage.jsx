import { CalendarDays, Clock3, MapPin, Plus, Users, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

function formatDate(value) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export default function EventsPage() {
  const { user } = useAuth()
  const { events, createEvent, cancelEvent } = useData()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ownEvents = user.role === 'resident' ? events.filter((item) => item.unit === 'A-101') : events
  const filtered = useMemo(() => ownEvents.filter((item) => `${item.space} ${item.title} ${item.resident} ${item.unit}`.toLowerCase().includes(search.toLowerCase())), [ownEvents, search])
  function submit(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget).entries()); createEvent({ ...form, resident: user.role === 'resident' ? user.name : form.resident, unit: user.role === 'resident' ? 'A-101' : form.unit, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }); setOpen(false) }
  return <div className="page"><PageHeader eyebrow="Áreas comuns" title="Reservas e eventos" description="Organize o uso dos espaços compartilhados." action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={17} />Nova reserva</button>} />
    <section className="panel list-panel"><div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar espaço, evento ou unidade..." /></div>{filtered.length === 0 ? <EmptyState icon={CalendarDays} title="Nenhuma reserva encontrada" /> : <div className="event-grid">{filtered.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt)).map((item) => <article className={`event-card event-${item.status}`} key={item.id}><div className="event-date"><strong>{new Date(item.startsAt).getDate()}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(item.startsAt)).replace('.', '')}</span></div><div className="event-content"><header><div><h3>{item.title}</h3><p><MapPin size={14} />{item.space}</p></div><Badge>{item.status}</Badge></header><div className="event-meta"><span><Clock3 />{formatDate(item.startsAt)}</span><span><Users />{item.guests} convidados</span><span>Responsável: {item.resident} · {item.unit}</span></div>{item.status === 'confirmada' && <footer><button className="button danger-outline" onClick={() => cancelEvent(item.id)}><XCircle size={16} />Cancelar reserva</button></footer>}</div></article>)}</div>}</section>
    <Modal open={open} onClose={() => setOpen(false)} title="Nova reserva" description="Confira a disponibilidade antes de confirmar." size="large"><form className="form-layout" onSubmit={submit}><label><span>Espaço *</span><select name="space"><option>Salão de festas</option><option>Churrasqueira</option><option>Quadra</option><option>Espaço gourmet</option><option>Sala de reuniões</option></select></label><label><span>Nome do evento *</span><input name="title" required /></label>{user.role !== 'resident' && <><label><span>Responsável *</span><input name="resident" required /></label><label><span>Unidade *</span><input name="unit" required /></label></>}<label><span>Início *</span><input name="startsAt" type="datetime-local" required /></label><label><span>Término *</span><input name="endsAt" type="datetime-local" required /></label><label className="span-2"><span>Quantidade de convidados *</span><input name="guests" type="number" min="1" max="300" required /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary">Confirmar reserva</button></div></form></Modal>
  </div>
}
