import {
  BellRing, Box, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3,
  Copy, FileImage, Filter, Mail, MessageCircle, Package, PackageCheck,
  Plus, Printer, QrCode, ScanLine, Search, Send, ShieldCheck, Truck, Upload, UserRound, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PackageDigitalPass from '../components/PackageDigitalPass'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { compressImage } from '../utils/image'

const PAGE_SIZE = 8

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—'
}

function shortDate(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'
}

function notificationLabel(status) {
  return status === 'enviado' ? 'Enviado' : status === 'simulado' ? 'Preparado para API' : 'Desativado'
}

export default function PackagesPage() {
  const { user } = useAuth()
  const {
    packages, createPackage, deliverPackage, resendPackageNotification,
    notifyPackages, addPackageComment,
  } = useData()
  const operational = ['admin', 'manager', 'concierge'].includes(user.role)
  const ownPackages = useMemo(() => user.role === 'resident' ? packages.filter((item) => item.unit === user.unit) : packages, [packages, user.role, user.unit])
  const [search, setSearch] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [status, setStatus] = useState('aguardando retirada')
  const [carrier, setCarrier] = useState('todas')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(ownPackages[0]?.id || null)
  const [checked, setChecked] = useState([])
  const [modal, setModal] = useState(null)
  const [photo, setPhoto] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [copied, setCopied] = useState(false)
  const [qrLookup, setQrLookup] = useState('')
  const [qrError, setQrError] = useState('')
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const carriers = useMemo(() => [...new Set(ownPackages.map((item) => item.carrier).filter(Boolean))].sort(), [ownPackages])
  const filtered = useMemo(() => ownPackages.filter((item) => {
    const content = `${item.protocol} ${item.recipient} ${item.unit} ${item.carrier} ${item.tracking} ${item.keywords}`.toLowerCase()
    return (status === 'todas' || item.status === status)
      && (carrier === 'todas' || item.carrier === carrier)
      && (!unitSearch || item.unit.toLowerCase().includes(unitSearch.toLowerCase()))
      && content.includes(search.toLowerCase())
  }), [ownPackages, search, unitSearch, status, carrier])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selected = ownPackages.find((item) => item.id === selectedId) || visible[0] || null

  useEffect(() => { setPage(1) }, [search, unitSearch, status, carrier])
  useEffect(() => { if (!selectedId && visible[0]) setSelectedId(visible[0].id) }, [selectedId, visible])

  async function selectPhoto(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try { setPhotoError(''); setPhoto(await compressImage(file)) } catch (error) { setPhotoError(error.message) }
    event.target.value = ''
  }

  function receive(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const item = createPackage({
      recipient: form.get('recipient'),
      unit: form.get('unit').toUpperCase(),
      carrier: form.get('carrier'),
      tracking: form.get('tracking'),
      packageType: form.get('packageType'),
      keywords: form.get('keywords'),
      description: form.get('description'),
      recipientEmail: form.get('recipientEmail'),
      recipientPhone: form.get('recipientPhone'),
      photo,
      notifyWhatsapp: form.get('notifyWhatsapp') === 'on',
      notifyEmail: form.get('notifyEmail') === 'on',
    })
    setSelectedId(item.id)
    setPhoto('')
    setModal('received')
  }

  function confirmDelivery(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    deliverPackage(selected.id, form.get('deliveredTo'), form.get('method'))
    setModal('delivered')
  }

  function scanQr(event) {
    event.preventDefault()
    const normalized = qrLookup.trim().toLowerCase()
    const item = ownPackages.find((entry) => entry.pickupToken?.toLowerCase() === normalized || String(entry.protocol).toLowerCase() === normalized)
    if (!item) { setQrError('QR Code ou protocolo não localizado.'); return }
    if (item.status === 'entregue') { setQrError('Esta encomenda já foi entregue.'); return }
    setQrError('')
    setSelectedId(item.id)
    setModal('deliver')
  }

  function saveComment(event) {
    event.preventDefault()
    const input = event.currentTarget.elements.comment
    addPackageComment(selected.id, input.value)
    input.value = ''
  }

  function toggleChecked(id) {
    setChecked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function toggleVisible() {
    const visibleIds = visible.map((item) => item.id)
    const allChecked = visibleIds.every((id) => checked.includes(id))
    setChecked((current) => allChecked ? current.filter((id) => !visibleIds.includes(id)) : [...new Set([...current, ...visibleIds])])
  }

  function notifySelected() {
    notifyPackages(checked)
    setChecked([])
  }

  const pickupUrl = selected?.pickupToken ? `${window.location.origin}/encomendas?retirada=${encodeURIComponent(selected.pickupToken)}` : ''
  const message = selected ? `Olá, ${selected.recipient}! Sua encomenda da ${selected.carrier} chegou ao Residencial COGEM. Protocolo ${selected.protocol}. Apresente o QR Code para retirar na portaria.` : ''
  async function copyMessage() {
    await navigator.clipboard?.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return <div className="page packages-page">
    <PageHeader
      eyebrow="Central operacional"
      title="Gestão de encomendas"
      description={user.role === 'resident' ? 'Veja o que chegou para sua unidade e apresente o QR Code na retirada.' : 'Receba, localize, avise a unidade e encerre entregas sem perder rastreabilidade.'}
      action={operational && <div className="header-actions"><button className="button secondary" onClick={() => { setQrLookup(''); setQrError(''); setModal('scanner') }}><ScanLine size={17} />Ler QR Code</button><button className="button primary" onClick={() => { setPhoto(''); setModal('new') }}><Plus size={17} />Nova encomenda</button></div>}
    />

    <section className="mini-stats package-stats">
      <div><Package /><span>Aguardando retirada<strong>{ownPackages.filter((item) => item.status === 'aguardando retirada').length}</strong></span></div>
      <div><PackageCheck /><span>Entregues hoje<strong>{ownPackages.filter((item) => item.status === 'entregue' && new Date(item.deliveredAt).toDateString() === new Date().toDateString()).length}</strong></span></div>
      <div><MessageCircle /><span>Unidades avisadas<strong>{ownPackages.filter((item) => item.notificationStatus?.whatsapp === 'enviado').length}</strong></span></div>
      <div><Truck /><span>Transportadoras<strong>{carriers.length}</strong></span></div>
    </section>

    <section className="package-control-deck">
      <article><span><PackageCheck /></span><div><small>Fluxo inteligente</small><strong>Receber → avisar → validar → auditar</strong><p>Cada etapa fica registrada no histórico da encomenda.</p></div></article>
      <article><span><ShieldCheck /></span><div><small>Retirada protegida</small><strong>QR individual e rastreável</strong><p>Token exclusivo, confirmação única e registro do operador.</p></div></article>
      <article><span><BellRing /></span><div><small>Comunicação integrada</small><strong>WhatsApp + e-mail</strong><p>Avisos preparados para conexão com as APIs oficiais.</p></div></article>
    </section>

    <section className="package-command-bar panel">
      <div className="package-search-group">
        <label><Search size={16} /><input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} placeholder="Buscar unidade" /></label>
        <label><UserRound size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Morador, protocolo ou rastreio" /></label>
      </div>
      <div className="package-filter-group">
        <label><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="aguardando retirada">Aguardando retirada</option><option value="entregue">Entregues</option><option value="todas">Todos os status</option></select></label>
        <select value={carrier} onChange={(event) => setCarrier(event.target.value)}><option value="todas">Todas as transportadoras</option>{carriers.map((item) => <option key={item}>{item}</option>)}</select>
        {checked.length > 0 && operational && <button className="button primary compact" onClick={notifySelected}><Send size={15} />Avisar {checked.length} unidade(s)</button>}
      </div>
    </section>

    <section className="package-workspace">
      <div className="package-table-panel panel">
        <div className="package-table-heading"><div><strong>Encomendas</strong><small>{filtered.length} registro(s) localizado(s)</small></div><span>Atualização em tempo real</span></div>
        {visible.length === 0 ? <EmptyState icon={Package} title="Nenhuma encomenda encontrada" description="Altere os filtros ou cadastre um novo volume." /> : <div className="package-table-scroll"><table className="package-operation-table"><thead><tr>{operational && <th><input type="checkbox" checked={visible.length > 0 && visible.every((item) => checked.includes(item.id))} onChange={toggleVisible} aria-label="Selecionar página" /></th>}<th>Protocolo</th><th>Enviado para</th><th>Destinatário</th><th>Status</th><th>Criado em</th><th>Recebido por</th><th>Ações</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : ''} onClick={() => setSelectedId(item.id)}>{operational && <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggleChecked(item.id)} aria-label={`Selecionar ${item.protocol}`} /></td>}<td><strong>#{item.protocol}</strong><small>{item.carrier}</small></td><td><button className="unit-link" onClick={() => setSelectedId(item.id)}>{item.unit}</button></td><td><strong>{item.recipient}</strong><small>{item.packageType || 'Volume'}</small></td><td><Badge>{item.status}</Badge></td><td><span className="date-cell"><Clock3 />{shortDate(item.receivedAt)}</span></td><td>{item.receivedBy || 'Portaria'}</td><td><div className="row-actions"><button title="Abrir detalhes" onClick={() => setSelectedId(item.id)}><QrCode /></button>{operational && item.status === 'aguardando retirada' && <button className="whatsapp-action" title="Avisar pelo WhatsApp" onClick={(event) => { event.stopPropagation(); resendPackageNotification(item.id, 'whatsapp') }}><MessageCircle /></button>}</div></td></tr>)}</tbody></table></div>}
        <footer className="package-pagination"><span>Página {page} de {pageCount}</span><div><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></button>{Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1).map((number) => <button key={number} className={page === number ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight /></button></div></footer>
      </div>

      <aside className="package-inspector panel">
        {!selected ? <EmptyState icon={Box} title="Selecione uma encomenda" description="Os detalhes aparecerão aqui." /> : <>
          <header className="inspector-header"><div><small>Protocolo</small><h2>#{selected.protocol || selected.id}</h2></div><button className="icon-button" title="Imprimir etiqueta" onClick={() => window.print()}><Printer /></button></header>
          <div className="inspector-body">
            <div className="inspector-destination"><span><small>Enviado para</small><strong>{selected.unit}</strong></span>{operational && selected.status === 'aguardando retirada' && <button onClick={() => resendPackageNotification(selected.id, 'whatsapp')}><MessageCircle />Avisar unidade</button>}</div>
            {selected.photo && <img className="inspector-photo" src={selected.photo} alt={`Volume ${selected.protocol}`} />}
            <div className="inspector-description"><small>Descrição</small><p>{selected.description || 'Chegou uma encomenda para sua unidade.'}</p></div>
            <div className="inspector-status"><small>Status</small><Badge>{selected.status}</Badge></div>
            {selected.status === 'aguardando retirada' && <PackageDigitalPass item={selected} pickupUrl={pickupUrl} compact />}
            <div className="inspector-data"><span><small>Código de rastreio</small><strong>{selected.tracking || 'Não informado'}</strong></span><span><small>Palavras-chave</small><strong>{selected.keywords || 'Não informadas'}</strong></span><span><small>Criado por</small><strong>{selected.receivedBy || 'Portaria'}</strong></span><span><small>Criado em</small><strong>{formatDate(selected.receivedAt)}</strong></span>{selected.status === 'entregue' && <><span><small>Retirado por</small><strong>{selected.deliveredTo}</strong></span><span><small>Entregue por</small><strong>{selected.deliveredBy || 'Portaria'}</strong></span></>}</div>
            <div className="notification-chips"><span><MessageCircle />WhatsApp: {notificationLabel(selected.notificationStatus?.whatsapp)}</span><span><Mail />E-mail: {notificationLabel(selected.notificationStatus?.email)}</span></div>
            <details className="inspector-history"><summary>Histórico e observações</summary><div>{(selected.comments || []).map((item) => <article key={item.id}><p>{item.text}</p><small>{item.author} · {shortDate(item.createdAt)}</small></article>)}{(selected.notificationLog || []).map((item) => <article key={item.id}><p>{item.channel}: {item.status}</p><small>{item.sentBy || 'Sistema'} · {shortDate(item.createdAt)}</small></article>)}{!(selected.comments?.length || selected.notificationLog?.length) && <small>Nenhum registro adicional.</small>}</div>{operational && <form onSubmit={saveComment}><input name="comment" required placeholder="Adicionar observação..." /><button><Send /></button></form>}</details>
          </div>
          <footer className="inspector-actions"><button className="button secondary" onClick={copyMessage}>{copied ? <Check /> : <Copy />}{copied ? 'Copiado' : 'Copiar aviso'}</button>{operational && selected.status === 'aguardando retirada' && <button className="button primary" onClick={() => setModal('deliver')}><PackageCheck />Encerrar entrega</button>}</footer>
        </>}
      </aside>
    </section>

    <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Nova encomenda" description="Registre o volume e avise o morador automaticamente." size="large"><form className="form-layout package-form" onSubmit={receive}><label><span>Destinatário *</span><input name="recipient" required /></label><label><span>Unidade *</span><input name="unit" required placeholder="A-101" /></label><label><span>WhatsApp *</span><input name="recipientPhone" required placeholder="(11) 99999-9999" /></label><label><span>E-mail *</span><input name="recipientEmail" type="email" required placeholder="morador@email.com" /></label><label><span>Transportadora *</span><input name="carrier" required placeholder="Mercado Livre, Correios..." /></label><label><span>Código de rastreio</span><input name="tracking" /></label><label><span>Tipo do volume</span><select name="packageType" defaultValue="Caixa"><option>Caixa</option><option>Pacote</option><option>Envelope</option><option>Sacola</option><option>Documento</option><option>Outro</option></select></label><label><span>Palavras-chave</span><input name="keywords" placeholder="Sacola amarela, caixa grande..." /></label><label className="span-2"><span>Descrição</span><textarea name="description" placeholder="Condição, local de armazenamento ou observações..." /></label><div className="photo-capture span-2"><div className="photo-capture-title"><span><FileImage />Foto da encomenda <small>Recomendada para identificação</small></span>{photo && <button type="button" onClick={() => setPhoto('')}><X />Remover</button>}</div>{photo ? <img src={photo} alt="Prévia da encomenda" /> : <div className="photo-placeholder"><Package /><strong>Nenhuma foto adicionada</strong><small>A imagem será otimizada antes do envio.</small></div>}<div className="photo-buttons"><button type="button" className="button secondary" onClick={() => cameraRef.current?.click()}><Camera />Tirar foto</button><button type="button" className="button secondary" onClick={() => galleryRef.current?.click()}><Upload />Escolher da galeria</button></div><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={selectPhoto} /><input ref={galleryRef} hidden type="file" accept="image/*" onChange={selectPhoto} />{photoError && <p className="form-error">{photoError}</p>}</div><div className="notification-options span-2"><label><input type="checkbox" name="notifyWhatsapp" defaultChecked /><MessageCircle /><span><strong>WhatsApp automático</strong><small>Protocolo e QR Code de retirada.</small></span></label><label><input type="checkbox" name="notifyEmail" defaultChecked /><Mail /><span><strong>E-mail automático</strong><small>Confirmação completa do recebimento.</small></span></label></div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary"><BellRing />Cadastrar e avisar</button></div></form></Modal>

    <Modal open={modal === 'scanner'} onClose={() => setModal(null)} title="Central de validação QR" description="Leia a credencial do morador ou confirme pelo protocolo seguro."><form className="qr-scanner-demo next-gen-scanner" onSubmit={scanQr}><div className="scanner-status"><span><i />Câmera segura pronta</span><small>Validação e auditoria em tempo real</small></div><div className="scanner-frame"><span className="scan-corner scan-a" /><span className="scan-corner scan-b" /><span className="scan-corner scan-c" /><span className="scan-corner scan-d" /><QrCode /><span className="scanner-laser" /><strong>Posicione o QR Code dentro da área</strong><small>No ambiente integrado, a câmera envia o token diretamente para a API de validação.</small></div><div className="scanner-divider"><span>ou validar manualmente</span></div><label><span>Token seguro ou protocolo</span><input value={qrLookup} onChange={(event) => setQrLookup(event.target.value)} placeholder="COGEM-PKG-001-ANA" /></label>{qrError && <p className="form-error">{qrError}</p>}<button className="button primary full-button"><ShieldCheck />Validar identidade e retirada</button><button type="button" className="scanner-example" onClick={() => setQrLookup(ownPackages.find((item) => item.status === 'aguardando retirada')?.pickupToken || '')}>Preencher credencial demonstrativa</button><div className="scanner-audit-note"><ShieldCheck /><span><strong>Operação auditada</strong><small>A confirmação registra encomenda, operador, horário e método utilizado.</small></span></div></form></Modal>

    <Modal open={modal === 'received'} onClose={() => setModal(null)} title="Encomenda registrada" description={selected ? `Protocolo #${selected.protocol}` : ''} size="large">{selected && <div className="qr-delivery"><div className="qr-success"><CheckCircle2 /><span><strong>Cadastro concluído</strong><small>A credencial foi criada e os canais de comunicação foram preparados.</small></span></div><PackageDigitalPass item={selected} pickupUrl={pickupUrl} /><div className="message-preview"><header><MessageCircle /><strong>Mensagem ao morador</strong><button onClick={copyMessage}>{copied ? <Check /> : <Copy />}{copied ? 'Copiado' : 'Copiar'}</button></header><p>{message}</p></div><button className="button primary full-button" onClick={() => setModal(null)}>Concluir operação</button></div>}</Modal>

    <Modal open={modal === 'deliver'} onClose={() => setModal(null)} title="Encerrar entrega" description={selected ? `#${selected.protocol} · ${selected.unit}` : ''}><form className="form-layout" onSubmit={confirmDelivery}><label className="span-2"><span>Nome de quem retirou *</span><input name="deliveredTo" required defaultValue={selected?.recipient || ''} /></label><label className="span-2"><span>Método de confirmação</span><select name="method" defaultValue="manual"><option value="manual">Confirmação manual</option><option value="qr-code">QR Code</option><option value="documento">Documento</option><option value="facial">Reconhecimento facial</option></select></label><div className="form-info span-2"><PackageCheck /><span><strong>Registro auditável</strong>O sistema salvará responsável, data, horário e método.</span></div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Confirmar retirada</button></div></form></Modal>

    <Modal open={modal === 'delivered'} onClose={() => setModal(null)} title="Entrega encerrada"><div className="success-state"><CheckCircle2 /><h3>Encomenda entregue</h3><p>A baixa foi registrada no histórico da portaria.</p><button className="button primary" onClick={() => setModal(null)}>Concluir</button></div></Modal>
  </div>
}
