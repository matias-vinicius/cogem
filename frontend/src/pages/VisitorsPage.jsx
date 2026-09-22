import { CalendarClock, CheckCircle2, Clock3, DoorOpen, LogOut, Plus, UserCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }

export default function VisitorsPage() {
  const { user } = useAuth()
  const { visitors, createVisitor, registerVisitorEntry, registerVisitorExit } = useData()
  const [tab, setTab] = useState('autorizados')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const operational = ['admin', 'manager', 'concierge'].includes(user.role)
  const ownVisitors = user.role === 'resident' ? visitors.filter((item) => item.unit === 'A-101') : visitors
  const filtered = useMemo(() => ownVisitors.filter((item) => {
    const tabMatch = tab === 'todos' || (tab === 'autorizados' && item.status === 'autorizado') || (tab === 'ativos' && item.status === 'dentro') || (tab === 'historico' && item.status === 'finalizado')
    return tabMatch && `${item.name} ${item.document} ${item.unit} ${item.resident} ${item.vehicle}`.toLowerCase().includes(search.toLowerCase())
  }), [ownVisitors, tab, search])

  function submit(event) {
    event.preventDefault()
    const form = Object.fromEntries(new FormData(event.currentTarget).entries())
    createVisitor({ ...form, validFrom: new Date(form.validFrom).toISOString(), validUntil: new Date(form.validUntil).toISOString(), resident: user.role === 'resident' ? user.name : form.resident, unit: user.role === 'resident' ? 'A-101' : form.unit })
    setOpen(false)
  }

  return <div className="page"><PageHeader eyebrow="Segurança e portaria" title="Visitantes" description="Autorize pessoas e acompanhe quem está no condomínio." action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={17} />Autorizar visitante</button>} />
    <section className="mini-stats"><div><UserCheck /><span>Autorizados<strong>{ownVisitors.filter((item) => item.status === 'autorizado').length}</strong></span></div><div><DoorOpen /><span>Dentro agora<strong>{ownVisitors.filter((item) => item.status === 'dentro').length}</strong></span></div><div><CheckCircle2 /><span>Finalizados<strong>{ownVisitors.filter((item) => item.status === 'finalizado').length}</strong></span></div></section>
    <section className="panel list-panel"><div className="list-toolbar"><div className="tabs"><button className={tab === 'autorizados' ? 'active' : ''} onClick={() => setTab('autorizados')}>Autorizados</button><button className={tab === 'ativos' ? 'active' : ''} onClick={() => setTab('ativos')}>Ativos</button><button className={tab === 'historico' ? 'active' : ''} onClick={() => setTab('historico')}>Histórico</button><button className={tab === 'todos' ? 'active' : ''} onClick={() => setTab('todos')}>Todos</button></div><SearchField value={search} onChange={setSearch} placeholder="Buscar visitante..." /></div>
      {filtered.length === 0 ? <EmptyState icon={Users} title="Nenhum visitante nesta lista" /> : <div className="visitor-grid">{filtered.map((item) => <article className="visitor-card" key={item.id}><header><span className="visitor-avatar">{item.name.charAt(0)}</span><div><h3>{item.name}</h3><p>{item.type} · {item.document}</p></div><Badge>{item.status}</Badge></header><div className="visitor-data"><span><strong>Destino</strong>{item.unit} · {item.resident}</span><span><strong>Validade</strong>{formatDate(item.validUntil)}</span>{item.vehicle && <span><strong>Veículo</strong>{item.vehicle}</span>}</div>{operational && <footer>{item.status === 'autorizado' && <button className="button primary" onClick={() => registerVisitorEntry(item.id)}><DoorOpen size={16} />Registrar entrada</button>}{item.status === 'dentro' && <button className="button danger-outline" onClick={() => registerVisitorExit(item.id)}><LogOut size={16} />Registrar saída</button>}{item.status === 'finalizado' && <span className="done-label"><CheckCircle2 size={16} />Visita encerrada</span>}</footer>}</article>)}</div>}
    </section>
    <Modal open={open} onClose={() => setOpen(false)} title="Autorizar visitante" description="Defina quem poderá acessar e o período da autorização." size="large"><form className="form-layout" onSubmit={submit}><label><span>Nome completo *</span><input name="name" required /></label><label><span>Documento *</span><input name="document" required /></label><label><span>Telefone</span><input name="phone" /></label><label><span>Tipo *</span><select name="type"><option>Visitante</option><option>Prestador</option><option>Entregador</option><option>Corretor</option></select></label>{user.role !== 'resident' && <><label><span>Unidade *</span><input name="unit" required placeholder="A-101" /></label><label><span>Morador responsável *</span><input name="resident" required /></label></>}<label><span>Válido a partir de *</span><input name="validFrom" type="datetime-local" required /></label><label><span>Válido até *</span><input name="validUntil" type="datetime-local" required /></label><label className="span-2"><span>Placa do veículo</span><input name="vehicle" placeholder="ABC1D23" /></label><div className="form-info span-2"><CalendarClock size={17} /><span><strong>Autorização temporária</strong>A portaria poderá registrar entrada e saída apenas dentro do período.</span></div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary">Criar autorização</button></div></form></Modal>
  </div>
}
