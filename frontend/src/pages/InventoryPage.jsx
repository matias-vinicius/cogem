import { AlertTriangle, ArrowDown, ArrowUp, Boxes, PackagePlus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { useData } from '../context/DataContext'

function formatDate(value) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }

export default function InventoryPage() {
  const { inventory, createInventoryItem, adjustInventory } = useData()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const categories = [...new Set(inventory.map((item) => item.category))]
  const filtered = useMemo(() => inventory.filter((item) => (category === 'todas' || item.category === category) && `${item.name} ${item.sku} ${item.location} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [inventory, search, category])
  function add(event) { event.preventDefault(); createInventoryItem(Object.fromEntries(new FormData(event.currentTarget).entries())); setModal(null) }
  function openMove(item) { setSelected(item); setModal('move') }
  function move(event) { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = Number(form.get('amount')); const delta = form.get('movement') === 'entrada' ? amount : -amount; adjustInventory(selected.id, delta, form.get('reason')); setModal(null); setSelected(null) }
  const totalUnits = inventory.reduce((sum, item) => sum + Number(item.quantity), 0)
  return <div className="page"><PageHeader eyebrow="Gestão de materiais" title="Estoque" description="Controle materiais, saldos mínimos e movimentações." action={<button className="button primary" onClick={() => setModal('new')}><Plus size={17} />Novo item</button>} />
    <section className="mini-stats"><div><Boxes /><span>Itens cadastrados<strong>{inventory.length}</strong></span></div><div><PackagePlus /><span>Unidades em estoque<strong>{totalUnits}</strong></span></div><div><AlertTriangle /><span>Abaixo do mínimo<strong>{inventory.filter((item) => item.quantity <= item.minimum).length}</strong></span></div></section>
    <section className="panel list-panel"><div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar item, SKU ou localização..." /><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="todas">Todas as categorias</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>{filtered.length === 0 ? <EmptyState icon={Boxes} /> : <div className="inventory-grid">{filtered.map((item) => { const low = item.quantity <= item.minimum; const percentage = Math.min(100, Math.max(8, (item.quantity / Math.max(item.minimum * 2, 1)) * 100)); return <article className={`inventory-card ${low ? 'is-low' : ''}`} key={item.id}><header><span className="inventory-icon"><Boxes size={20} /></span><Badge tone={low ? 'urgente' : 'disponivel'}>{low ? 'estoque baixo' : 'normal'}</Badge></header><h3>{item.name}</h3><p>{item.sku} · {item.category}</p><div className="stock-number"><strong>{item.quantity}</strong><span>{item.unit}<small>Mínimo: {item.minimum}</small></span></div><div className="stock-progress"><i style={{ width: `${percentage}%` }} /></div><footer><span>{item.location}<small>Atualizado {formatDate(item.updatedAt)}</small></span><button className="table-button" onClick={() => openMove(item)}>Movimentar</button></footer></article> })}</div>}</section>
    <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Cadastrar item no estoque" size="large"><form className="form-layout" onSubmit={add}><label><span>Nome *</span><input name="name" required /></label><label><span>SKU/Código *</span><input name="sku" required /></label><label><span>Categoria *</span><input name="category" required placeholder="Elétrica, hidráulica..." /></label><label><span>Unidade *</span><select name="unit"><option>un</option><option>pct</option><option>cx</option><option>kg</option><option>m</option><option>L</option></select></label><label><span>Quantidade inicial *</span><input name="quantity" type="number" min="0" required /></label><label><span>Estoque mínimo *</span><input name="minimum" type="number" min="0" required /></label><label className="span-2"><span>Localização *</span><input name="location" required placeholder="Almoxarifado A" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Cadastrar item</button></div></form></Modal>
    <Modal open={modal === 'move'} onClose={() => setModal(null)} title="Movimentar estoque" description={selected && `${selected.name} · saldo atual: ${selected.quantity} ${selected.unit}`}><form className="form-layout" onSubmit={move}><label><span>Movimento *</span><select name="movement"><option value="entrada">Entrada</option><option value="saída">Saída</option></select></label><label><span>Quantidade *</span><input name="amount" type="number" min="1" required /></label><label className="span-2"><span>Motivo *</span><input name="reason" required placeholder="Compra, uso em manutenção..." /></label><div className="movement-preview span-2"><span><ArrowUp size={17} />Entrada aumenta o saldo</span><span><ArrowDown size={17} />Saída registra consumo</span></div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Confirmar movimento</button></div></form></Modal>
  </div>
}
