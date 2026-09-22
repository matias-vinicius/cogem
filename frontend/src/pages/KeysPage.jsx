import { CheckCircle2, Clock3, KeyRound, Plus, RotateCcw, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useData } from '../context/DataContext'

function formatDate(value) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—' }

export default function KeysPage() {
  const { keys, createKey, checkoutKey, returnKey } = useData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('todas')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const filtered = useMemo(() => keys.filter((item) => (status === 'todas' || item.status === status) && `${item.name} ${item.code} ${item.location} ${item.holder}`.toLowerCase().includes(search.toLowerCase())), [keys, search, status])
  function add(event) { event.preventDefault(); createKey(Object.fromEntries(new FormData(event.currentTarget).entries())); setModal(null) }
  function openCheckout(item) { setSelected(item); setModal('checkout') }
  function checkout(event) { event.preventDefault(); const form = Object.fromEntries(new FormData(event.currentTarget).entries()); checkoutKey(selected.id, { ...form, expectedReturn: form.expectedReturn ? new Date(form.expectedReturn).toISOString() : null }); setModal(null); setSelected(null) }
  return <div className="page"><PageHeader eyebrow="Portaria" title="Controle de chaves" description="Acompanhe disponibilidade, retiradas e devoluções." action={<button className="button primary" onClick={() => setModal('new')}><Plus size={17} />Cadastrar chave</button>} />
    <section className="mini-stats"><div><KeyRound /><span>Total de chaves<strong>{keys.length}</strong></span></div><div><CheckCircle2 /><span>Disponíveis<strong>{keys.filter((item) => item.status === 'disponível').length}</strong></span></div><div><UserRound /><span>Retiradas<strong>{keys.filter((item) => item.status === 'retirada').length}</strong></span></div></section>
    <section className="panel list-panel"><div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar chave, código ou responsável..." /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todas">Todos os status</option><option value="disponível">Disponíveis</option><option value="retirada">Retiradas</option></select></div>{filtered.length === 0 ? <EmptyState icon={KeyRound} /> : <div className="key-grid">{filtered.map((item) => <article key={item.id} className={`key-card key-${item.status}`}><header><span><KeyRound size={21} /></span><Badge>{item.status}</Badge></header><h3>{item.name}</h3><p>{item.code} · {item.location}</p>{item.status === 'retirada' ? <div className="key-holder"><span><UserRound size={15} />{item.holder}</span><span><Clock3 size={15} />{formatDate(item.checkedOutAt)}</span><small>{item.purpose}</small></div> : <div className="key-available"><CheckCircle2 size={17} />Pronta para retirada</div>}<footer>{item.status === 'disponível' ? <button className="button primary" onClick={() => openCheckout(item)}>Registrar retirada</button> : <button className="button secondary" onClick={() => returnKey(item.id)}><RotateCcw size={16} />Registrar devolução</button>}</footer></article>)}</div>}</section>
    <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Cadastrar chave"><form className="form-layout" onSubmit={add}><label><span>Nome *</span><input name="name" required placeholder="Ex.: Casa de máquinas" /></label><label><span>Código *</span><input name="code" required placeholder="CH-004" /></label><label className="span-2"><span>Local de armazenamento *</span><input name="location" required defaultValue="Portaria" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Cadastrar</button></div></form></Modal>
    <Modal open={modal === 'checkout'} onClose={() => setModal(null)} title="Registrar retirada" description={selected?.name}><form className="form-layout" onSubmit={checkout}><label className="span-2"><span>Responsável *</span><input name="holder" required /></label><label className="span-2"><span>Finalidade *</span><input name="purpose" required /></label><label className="span-2"><span>Previsão de devolução</span><input name="expectedReturn" type="datetime-local" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Confirmar retirada</button></div></form></Modal>
  </div>
}
