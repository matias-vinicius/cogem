import { CalendarDays, CheckCircle2, Gavel, MapPin, Plus, Users, Vote } from 'lucide-react'
import { useState } from 'react'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import DemoBanner from '../components/DemoBanner'
import { useData } from '../context/DataContext'

const date = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))

export default function AssembliesPage() {
  const { assemblies, createAssembly, voteAssembly } = useData()
  const [modal, setModal] = useState(false)
  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createAssembly({ title: form.get('title'), description: form.get('description'), startsAt: form.get('startsAt'), location: form.get('location'), agenda: [form.get('agenda1'), form.get('agenda2'), form.get('agenda3')] })
    setModal(false)
  }
  return <div className="page">
    <PageHeader eyebrow="Decisão transparente" title="Assembleias e votações" description="Pautas, participação, quórum e votação digital com histórico auditável." action={<button className="button primary" onClick={() => setModal(true)}><Plus />Nova assembleia</button>} />
    <DemoBanner title="Assembleias, quórum e votações estão em avaliação" />
    <section className="suite-stats"><div><Gavel /><span>Assembleias<strong>{assemblies.length}</strong><small>registradas na plataforma</small></span></div><div><Vote /><span>Pautas digitais<strong>{assemblies.reduce((total, item) => total + item.agenda.filter(Boolean).length, 0)}</strong><small>prontas para deliberação</small></span></div><div><Users /><span>Quórum médio<strong>{assemblies.length ? Math.round(assemblies.reduce((total, item) => total + Number(item.quorum || 0), 0) / assemblies.length) : 0}%</strong><small>participação confirmada</small></span></div><div><CheckCircle2 /><span>Votos registrados<strong>{assemblies.reduce((total, item) => total + Object.keys(item.votes || {}).length, 0)}</strong><small>com trilha auditável</small></span></div></section>
    <div className="assembly-list">{assemblies.map((item) => <section className="panel assembly-card" key={item.id}><header><span className="assembly-icon"><Gavel /></span><div><Badge tone="blue">{item.status}</Badge><h2>{item.title}</h2><p>{item.description}</p></div><div className="quorum"><Users /><strong>{item.quorum}%</strong><small>quórum confirmado</small></div></header><div className="assembly-meta"><span><CalendarDays />{date(item.startsAt)}</span><span><MapPin />{item.location}</span></div><div className="agenda-list"><h3>Pautas da assembleia</h3>{item.agenda.map((agenda, index) => { const vote = item.votes?.[`4-${index}`]; return <article key={agenda}><div><span>{index + 1}</span><strong>{agenda}</strong></div><div>{['Aprovar', 'Rejeitar', 'Abster'].map((choice) => <button key={choice} className={vote === choice ? 'selected' : ''} onClick={() => voteAssembly(item.id, index, choice)}>{vote === choice && <CheckCircle2 />}{choice}</button>)}</div></article> })}</div></section>)}</div>
    <Modal open={modal} onClose={() => setModal(false)} title="Nova assembleia" size="large"><form className="form-layout" onSubmit={submit}><label className="span-2"><span>Título *</span><input name="title" required /></label><label><span>Data e horário</span><input name="startsAt" type="datetime-local" required /></label><label><span>Local ou link</span><input name="location" required /></label><label className="span-2"><span>Descrição</span><textarea name="description" /></label><label className="span-2"><span>Pauta 1 *</span><input name="agenda1" required /></label><label className="span-2"><span>Pauta 2</span><input name="agenda2" /></label><label className="span-2"><span>Pauta 3</span><input name="agenda3" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(false)}>Cancelar</button><button className="button primary"><Vote />Agendar assembleia</button></div></form></Modal>
  </div>
}
