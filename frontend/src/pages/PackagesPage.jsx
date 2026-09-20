import { CheckCircle2, Clock3, Package, PackageCheck, Plus, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }

export default function PackagesPage() {
  const { user } = useAuth()
  const { packages, createPackage, deliverPackage } = useData()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('pendentes')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const operational = ['admin', 'manager', 'concierge'].includes(user.role)
  const ownPackages = user.role === 'resident' ? packages.filter((item) => item.unit === 'A-101') : packages
  const filtered = useMemo(() => ownPackages.filter((item) => (tab === 'todas' || (tab === 'pendentes' ? item.status === 'aguardando retirada' : item.status === 'entregue')) && `${item.recipient} ${item.unit} ${item.carrier} ${item.tracking}`.toLowerCase().includes(search.toLowerCase())), [ownPackages, search, tab])

  function receive(event) { event.preventDefault(); const form = new FormData(event.currentTarget); createPackage(Object.fromEntries(form.entries())); setModal(null) }
  function openDelivery(item) { setSelected(item); setModal('deliver') }
  function confirmDelivery(event) { event.preventDefault(); const name = new FormData(event.currentTarget).get('deliveredTo'); deliverPackage(selected.id, name); setModal(null); setSelected(null) }

  return <div className="page"><PageHeader eyebrow="Portaria" title="Encomendas" description="Controle o recebimento e a retirada de volumes." action={operational && <button className="button primary" onClick={() => setModal('new')}><Plus size={17} />Receber encomenda</button>} />
    <section className="mini-stats"><div><Package /><span>Aguardando retirada<strong>{ownPackages.filter((item) => item.status === 'aguardando retirada').length}</strong></span></div><div><PackageCheck /><span>Entregues hoje<strong>{ownPackages.filter((item) => item.status === 'entregue' && new Date(item.deliveredAt).toDateString() === new Date().toDateString()).length}</strong></span></div><div><Truck /><span>Transportadoras<strong>{new Set(ownPackages.map((item) => item.carrier)).size}</strong></span></div></section>
    <section className="panel list-panel"><div className="list-toolbar"><div className="tabs"><button className={tab === 'pendentes' ? 'active' : ''} onClick={() => setTab('pendentes')}>Aguardando retirada</button><button className={tab === 'entregues' ? 'active' : ''} onClick={() => setTab('entregues')}>Entregues</button><button className={tab === 'todas' ? 'active' : ''} onClick={() => setTab('todas')}>Todas</button></div><SearchField value={search} onChange={setSearch} placeholder="Buscar encomenda..." /></div>
      {filtered.length === 0 ? <EmptyState icon={Package} title="Nenhuma encomenda nesta lista" /> : <div className="responsive-table"><table><thead><tr><th>Destinatário</th><th>Unidade</th><th>Transportadora</th><th>Rastreio</th><th>Status</th><th>Recebida em</th><th>Ação</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td data-label="Destinatário"><strong>{item.recipient}</strong><small>{item.description}</small></td><td data-label="Unidade"><strong>{item.unit}</strong></td><td data-label="Transportadora">{item.carrier}</td><td data-label="Rastreio"><code>{item.tracking || '—'}</code></td><td data-label="Status"><Badge>{item.status}</Badge></td><td data-label="Recebida em"><span className="date-cell"><Clock3 size={14} />{formatDate(item.receivedAt)}</span></td><td data-label="Ação">{item.status === 'aguardando retirada' && operational ? <button className="table-button success" onClick={() => openDelivery(item)}>Registrar retirada</button> : item.status === 'entregue' ? <span className="done-label"><CheckCircle2 size={15} />{item.deliveredTo}</span> : '—'}</td></tr>)}</tbody></table></div>}
    </section>
    <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Receber encomenda" description="Registre o volume que chegou à portaria."><form className="form-layout" onSubmit={receive}><label><span>Destinatário *</span><input name="recipient" required /></label><label><span>Unidade *</span><input name="unit" required placeholder="A-101" /></label><label><span>Transportadora *</span><input name="carrier" required placeholder="Correios, Amazon..." /></label><label><span>Código de rastreio</span><input name="tracking" /></label><label className="span-2"><span>Descrição do volume</span><input name="description" placeholder="Caixa pequena, envelope..." /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Confirmar recebimento</button></div></form></Modal>
    <Modal open={modal === 'deliver'} onClose={() => setModal(null)} title="Registrar retirada" description={`${selected?.recipient || ''} · ${selected?.unit || ''}`}><form className="form-layout" onSubmit={confirmDelivery}><label className="span-2"><span>Nome de quem retirou *</span><input name="deliveredTo" required defaultValue={selected?.recipient || ''} /></label><div className="form-info span-2"><PackageCheck size={17} /><span><strong>Confirmação de entrega</strong>A data, o horário e o operador serão registrados automaticamente.</span></div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Confirmar retirada</button></div></form></Modal>
  </div>
}
