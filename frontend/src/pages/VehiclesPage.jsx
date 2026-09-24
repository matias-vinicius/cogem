import { ArrowDownLeft, ArrowUpRight, CarFront, CircleParking, Plus, RadioTower } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useData } from '../context/DataContext'

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
}

export default function VehiclesPage() {
  const { vehicles, vehicleLogs, createVehicle, registerVehicleMovement } = useData()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('dentro')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const filtered = useMemo(() => vehicles.filter((item) => (tab === 'todos' || item.status === tab) && `${item.plate} ${item.model} ${item.owner} ${item.unit} ${item.tag}`.toLowerCase().includes(search.toLowerCase())), [vehicles, tab, search])

  function submit(event) {
    event.preventDefault()
    createVehicle(Object.fromEntries(new FormData(event.currentTarget).entries()))
    setModal(null)
  }

  function openMovement(item) {
    setSelected(item)
    setModal('movement')
  }

  function move(method) {
    const direction = selected.status === 'dentro' ? 'saída' : 'entrada'
    registerVehicleMovement(selected.id, direction, method)
    setSelected(null)
    setModal(null)
  }

  return <div className="page vehicles-page">
    <PageHeader eyebrow="Mobilidade e segurança" title="Controle de veículos" description="Acompanhe entradas, saídas, vagas e identificações veiculares." action={<button className="button primary" onClick={() => setModal('new')}><Plus size={17} />Cadastrar veículo</button>} />
    <section className="mini-stats">
      <div><CircleParking /><span>Dentro agora<strong>{vehicles.filter((item) => item.status === 'dentro').length}</strong></span></div>
      <div><ArrowDownLeft /><span>Entradas hoje<strong>{vehicleLogs.filter((item) => item.direction === 'entrada' && new Date(item.createdAt).toDateString() === new Date().toDateString()).length}</strong></span></div>
      <div><ArrowUpRight /><span>Saídas hoje<strong>{vehicleLogs.filter((item) => item.direction === 'saída' && new Date(item.createdAt).toDateString() === new Date().toDateString()).length}</strong></span></div>
      <div><RadioTower /><span>Tags cadastradas<strong>{vehicles.filter((item) => item.tag).length}</strong></span></div>
    </section>
    <section className="panel list-panel">
      <div className="list-toolbar"><div className="tabs"><button className={tab === 'dentro' ? 'active' : ''} onClick={() => setTab('dentro')}>Dentro</button><button className={tab === 'fora' ? 'active' : ''} onClick={() => setTab('fora')}>Fora</button><button className={tab === 'todos' ? 'active' : ''} onClick={() => setTab('todos')}>Todos</button></div><SearchField value={search} onChange={setSearch} placeholder="Buscar placa, proprietário ou unidade..." /></div>
      {filtered.length === 0 ? <EmptyState icon={CarFront} title="Nenhum veículo nesta lista" /> : <div className="vehicle-grid">{filtered.map((item) => <article className="vehicle-card" key={item.id}><header><span className="vehicle-icon"><CarFront /></span><div><strong>{item.plate}</strong><small>{item.model} · {item.color}</small></div><Badge tone={item.status === 'dentro' ? 'green' : 'blue'}>{item.status}</Badge></header><div className="vehicle-owner"><span>Proprietário<strong>{item.owner}</strong></span><span>Unidade<strong>{item.unit}</strong></span></div><div className="vehicle-meta"><span>{item.category}</span><span>{item.tag || 'Sem tag'}</span><span>{item.status === 'dentro' ? `Entrou ${formatDate(item.enteredAt)}` : `Saiu ${formatDate(item.exitedAt)}`}</span></div><button className={`button ${item.status === 'dentro' ? 'danger-outline' : 'primary'}`} onClick={() => openMovement(item)}>{item.status === 'dentro' ? <><ArrowUpRight size={16} />Registrar saída</> : <><ArrowDownLeft size={16} />Registrar entrada</>}</button></article>)}</div>}
    </section>
    <section className="panel vehicle-history"><header className="panel-header"><div><span className="eyebrow">Auditoria</span><h2>Movimentações recentes</h2></div></header><div>{vehicleLogs.slice(0, 6).map((item) => <article key={item.id}><span className={`access-icon access-${item.direction}`}>{item.direction === 'entrada' ? <ArrowDownLeft /> : <ArrowUpRight />}</span><div><strong>{item.plate} · {item.owner}</strong><small>{item.unit} · {item.method} · {item.registeredBy}</small></div><time>{formatDate(item.createdAt)}</time></article>)}</div></section>

    <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Cadastrar veículo" description="Associe o veículo ao responsável e à unidade."><form className="form-layout" onSubmit={submit}><label><span>Placa *</span><input name="plate" required maxLength="8" placeholder="ABC1D23" /></label><label><span>Modelo *</span><input name="model" required placeholder="Honda Civic" /></label><label><span>Cor *</span><input name="color" required /></label><label><span>Categoria *</span><select name="category"><option>Morador</option><option>Visitante</option><option>Prestador</option><option>Funcionário</option></select></label><label><span>Proprietário/responsável *</span><input name="owner" required /></label><label><span>Unidade/destino *</span><input name="unit" required placeholder="A-101" /></label><label className="span-2"><span>Identificação TAG/RFID</span><input name="tag" placeholder="TAG-0101" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Cadastrar veículo</button></div></form></Modal>
    <Modal open={modal === 'movement'} onClose={() => setModal(null)} title={`Registrar ${selected?.status === 'dentro' ? 'saída' : 'entrada'}`} description={selected ? `${selected.plate} · ${selected.owner}` : ''}><div className="movement-methods"><p>Escolha como a identificação foi validada:</p><button onClick={() => move('tag')}><RadioTower /><span><strong>TAG / RFID</strong><small>Leitura automática da cancela</small></span></button><button onClick={() => move('placa')}><CarFront /><span><strong>Leitura de placa</strong><small>Reconhecimento veicular</small></span></button><button onClick={() => move('manual')}><CircleParking /><span><strong>Registro manual</strong><small>Validação realizada pela portaria</small></span></button></div></Modal>
  </div>
}
