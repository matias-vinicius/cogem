import { Building2, CalendarClock, Cat, Dog, Gauge, Plus, Truck } from 'lucide-react'
import { useState } from 'react'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import DemoBanner from '../components/DemoBanner'
import { useData } from '../context/DataContext'

const date = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

export default function RegistrationsPage() {
  const { pets, moves, meterReadings, createPet, createMove, recordMeterReading } = useData()
  const [tab, setTab] = useState('pets')
  const [modal, setModal] = useState(null)
  function submit(event, action) {
    event.preventDefault()
    action(Object.fromEntries(new FormData(event.currentTarget)))
    setModal(null)
  }
  return <div className="page">
    <PageHeader eyebrow="Vida condominial" title="Cadastros complementares" description="Pets, mudanças e leituras de consumo organizados por unidade." action={<button className="button primary" onClick={() => setModal(tab)}><Plus />Novo cadastro</button>} />
    <DemoBanner title="Pets, mudanças e leituras de consumo estão em avaliação" />
    <section className="suite-stats"><div><Dog /><span>Pets cadastrados<strong>{pets.length}</strong><small>com unidade e tutor</small></span></div><div><Truck /><span>Mudanças agendadas<strong>{moves.filter((item) => !['concluída', 'cancelada'].includes(String(item.status).toLowerCase())).length}</strong><small>em fluxo operacional</small></span></div><div><Gauge /><span>Leituras registradas<strong>{meterReadings.length}</strong><small>água, gás e energia</small></span></div><div><Building2 /><span>Unidades mapeadas<strong>{new Set([...pets.map((item) => item.unit), ...moves.map((item) => item.unit), ...meterReadings.map((item) => item.unit)]).size}</strong><small>visão condominial integrada</small></span></div></section>
    <section className="panel"><div className="list-toolbar"><div className="tabs"><button className={tab === 'pets' ? 'active' : ''} onClick={() => setTab('pets')}>Pets</button><button className={tab === 'moves' ? 'active' : ''} onClick={() => setTab('moves')}>Mudanças</button><button className={tab === 'meters' ? 'active' : ''} onClick={() => setTab('meters')}>Consumos</button></div></div>
      {tab === 'pets' && <div className="registry-grid">{pets.map((item) => <article key={item.id}><span className="registry-icon">{item.species === 'Gato' ? <Cat /> : <Dog />}</span><div><h3>{item.name}</h3><p>{item.species} · {item.breed}</p><strong>{item.unit} · {item.guardian}</strong><small>{item.notes}</small></div></article>)}</div>}
      {tab === 'moves' && <div className="registry-grid">{moves.map((item) => <article key={item.id}><span className="registry-icon"><Truck /></span><div><header><h3>{item.type} · {item.unit}</h3><Badge>{item.status}</Badge></header><p>{item.resident} · {item.company}</p><strong><CalendarClock />{date(item.scheduledAt)}</strong><small>Veículo: {item.vehicle || 'Não informado'}</small></div></article>)}</div>}
      {tab === 'meters' && <div className="registry-grid">{meterReadings.map((item) => <article key={item.id}><span className="registry-icon"><Gauge /></span><div><h3>{item.meter} · {item.unit}</h3><p>Referência {item.reference}</p><strong>{item.current - item.previous} unidades consumidas</strong><small>Anterior {item.previous} · Atual {item.current}</small></div></article>)}</div>}
    </section>
    <Modal open={modal === 'pets'} onClose={() => setModal(null)} title="Cadastrar pet"><form className="form-layout" onSubmit={(event) => submit(event, createPet)}><label><span>Nome *</span><input name="name" required /></label><label><span>Espécie</span><select name="species"><option>Cachorro</option><option>Gato</option><option>Ave</option><option>Outro</option></select></label><label><span>Raça</span><input name="breed" /></label><label><span>Unidade *</span><input name="unit" required /></label><label className="span-2"><span>Tutor *</span><input name="guardian" required /></label><label className="span-2"><span>Observações</span><textarea name="notes" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Cadastrar</button></div></form></Modal>
    <Modal open={modal === 'moves'} onClose={() => setModal(null)} title="Agendar mudança"><form className="form-layout" onSubmit={(event) => submit(event, createMove)}><label><span>Unidade *</span><input name="unit" required /></label><label><span>Morador *</span><input name="resident" required /></label><label><span>Tipo</span><select name="type"><option>Entrada</option><option>Saída</option><option>Interna</option></select></label><label><span>Data e horário</span><input name="scheduledAt" type="datetime-local" required /></label><label><span>Empresa</span><input name="company" /></label><label><span>Veículo</span><input name="vehicle" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Agendar</button></div></form></Modal>
    <Modal open={modal === 'meters'} onClose={() => setModal(null)} title="Registrar leitura"><form className="form-layout" onSubmit={(event) => submit(event, recordMeterReading)}><label><span>Unidade *</span><input name="unit" required /></label><label><span>Medidor</span><select name="meter"><option>Água</option><option>Gás</option><option>Energia</option></select></label><label><span>Leitura anterior</span><input name="previous" type="number" required /></label><label><span>Leitura atual</span><input name="current" type="number" required /></label><label className="span-2"><span>Referência</span><input name="reference" placeholder="09/2026" required /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Registrar</button></div></form></Modal>
  </div>
}
