import { Camera, CheckCircle2, Plus, ScanFace, ShieldCheck, Upload, UserCheck, UserX, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { PERMISSIONS, ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { compressImage } from '../utils/image'

const permissionLabels = {
  dashboard: 'Visão geral', occurrences: 'Ocorrências', packages: 'Encomendas',
  logbook: 'Livro da portaria', keys: 'Chaves', visitors: 'Visitantes', vehicles: 'Veículos',
  access: 'Controle de acesso', inventory: 'Estoque', events: 'Reservas e eventos',
  communications: 'Comunicação', maintenanceHub: 'Manutenção e OS', documents: 'Documentos',
  finance: 'Financeiro', assemblies: 'Assembleias', registrations: 'Pets e consumo',
  users: 'Usuários e acessos', settings: 'Configurações', profile: 'Perfil', help: 'Ajuda',
}

const roleDescriptions = {
  admin: 'Administra a plataforma e a operação, sem acesso aos dados financeiros do condomínio.',
  manager: 'Visão completa da gestão. É o único perfil com Financeiro, Assembleias e Cadastros.',
  concierge: 'Opera portaria, encomendas, visitantes, veículos, chaves e controle de acesso.',
  maintenance: 'Atende ocorrências, ordens de serviço, estoque e documentos técnicos.',
  resident: 'Consulta as próprias encomendas, registra ocorrências e gerencia o perfil.',
}

export default function UsersPage() {
  const { user: session } = useAuth()
  const { users, createUser, toggleUser, updateUserFace } = useData()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('todos')
  const [modal, setModal] = useState(null)
  const [facePhoto, setFacePhoto] = useState('')
  const [selected, setSelected] = useState(null)
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const assignableRoles = Object.entries(ROLE_LABELS).filter(([value]) => session.role === 'admin' || value !== 'admin')
  const filtered = useMemo(() => users.filter((item) => (role === 'todos' || item.role === role) && `${item.name} ${item.email} ${item.unit} ${ROLE_LABELS[item.role]}`.toLowerCase().includes(search.toLowerCase())), [users, search, role])

  async function selectFace(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setFacePhoto(await compressImage(file, 720, 0.8))
    event.target.value = ''
  }

  function submit(event) {
    event.preventDefault()
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries())
    createUser({ ...payload, facePhoto, faceStatus: facePhoto ? 'cadastrada' : 'pendente', faceRegisteredAt: facePhoto ? new Date().toISOString() : null })
    setFacePhoto('')
    setModal(null)
  }

  function openFace(item) { setSelected(item); setFacePhoto(item.facePhoto || ''); setModal('face') }
  function saveFace() { if (!facePhoto) return; updateUserFace(selected.id, facePhoto); setModal(null); setSelected(null); setFacePhoto('') }

  const facialCapture = <div className="facial-capture"><div className="facial-preview">{facePhoto ? <img src={facePhoto} alt="Biometria facial" /> : <ScanFace />}{facePhoto && <span><CheckCircle2 />Imagem capturada</span>}</div><div><strong>Biometria facial</strong><p>Capture uma imagem frontal, bem iluminada e sem acessórios cobrindo o rosto.</p><div className="photo-buttons"><button type="button" className="button secondary" onClick={() => cameraRef.current?.click()}><Camera />Abrir câmera</button><button type="button" className="button secondary" onClick={() => galleryRef.current?.click()}><Upload />Enviar foto</button></div></div><input ref={cameraRef} hidden type="file" accept="image/*" capture="user" onChange={selectFace} /><input ref={galleryRef} hidden type="file" accept="image/*" onChange={selectFace} /></div>

  return <div className="page users-page"><PageHeader eyebrow="Identidade e permissões" title="Usuários e acessos" description="Gerencie contas, funções e credenciais biométricas." action={<button className="button primary" onClick={() => { setFacePhoto(''); setModal('new') }}><Plus size={17} />Novo usuário</button>} />
    <section className="mini-stats"><div><Users /><span>Total de usuários<strong>{users.length}</strong></span></div><div><UserCheck /><span>Ativos<strong>{users.filter((item) => item.active).length}</strong></span></div><div><ScanFace /><span>Faciais cadastradas<strong>{users.filter((item) => item.faceStatus === 'cadastrada').length}</strong></span></div><div><ShieldCheck /><span>Administradores<strong>{users.filter((item) => ['admin', 'manager'].includes(item.role)).length}</strong></span></div></section>
    <section className="panel permission-matrix"><header className="panel-header"><div><span className="eyebrow">Controle por função</span><h2>Matriz de acesso por perfil</h2><p>Cada pessoa visualiza somente as telas necessárias para o seu trabalho.</p></div><span className="manager-only-note"><ShieldCheck size={14} />Financeiro: somente Síndico</span></header><div className="permission-profile-grid">{Object.entries(ROLE_LABELS).map(([profile, label]) => <article key={profile} className={profile === 'manager' ? 'featured' : ''}><header><Badge tone={profile}>{label}</Badge><small>{PERMISSIONS[profile].length} permissões</small></header><p>{roleDescriptions[profile]}</p><div>{PERMISSIONS[profile].filter((module) => !['profile', 'help'].includes(module)).map((module) => <span key={module}>{permissionLabels[module]}</span>)}</div></article>)}</div></section>
    <section className="panel list-panel"><div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar nome, e-mail ou unidade..." /><select value={role} onChange={(event) => setRole(event.target.value)}><option value="todos">Todos os perfis</option>{Object.entries(ROLE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>{filtered.length === 0 ? <EmptyState icon={Users} /> : <div className="responsive-table"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Unidade/setor</th><th>Facial</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td data-label="Usuário"><div className="user-cell"><span>{item.facePhoto ? <img src={item.facePhoto} alt="" /> : item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>{item.email}</small></div></div></td><td data-label="Perfil"><Badge tone={item.role}>{ROLE_LABELS[item.role]}</Badge></td><td data-label="Unidade/setor">{item.unit}</td><td data-label="Facial"><Badge tone={item.faceStatus === 'cadastrada' ? 'green' : 'orange'}>{item.faceStatus || 'pendente'}</Badge></td><td data-label="Status"><Badge tone={item.active ? 'ativo' : 'inativo'}>{item.active ? 'ativo' : 'inativo'}</Badge></td><td data-label="Ações"><div className="table-actions"><button className="table-button" onClick={() => openFace(item)}><ScanFace />Facial</button><button className={`table-button ${item.active ? 'danger' : 'success'}`} disabled={item.id === session.id || (item.role === 'admin' && session.role !== 'admin')} onClick={() => toggleUser(item.id)}>{item.active ? <><UserX />Desativar</> : <><UserCheck />Ativar</>}</button></div></td></tr>)}</tbody></table></div>}</section>
    <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Novo usuário" description="Cadastre identidade, função e biometria facial." size="large"><form className="form-layout" onSubmit={submit}><label><span>Nome completo *</span><input name="name" required /></label><label><span>E-mail *</span><input name="email" type="email" required /></label><label><span>WhatsApp *</span><input name="phone" required /></label><label><span>Perfil de acesso *</span><select name="role">{assignableRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Unidade/setor *</span><input name="unit" required placeholder="A-101 ou Portaria" /></label><label><span>Senha provisória *</span><input name="password" type="password" required minLength="6" defaultValue="123456" /></label><div className="span-2">{facialCapture}</div><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Criar usuário</button></div></form></Modal>
    <Modal open={modal === 'face'} onClose={() => setModal(null)} title="Cadastrar reconhecimento facial" description={selected ? `${selected.name} · ${selected.unit}` : ''}>{facialCapture}<div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" disabled={!facePhoto} onClick={saveFace}><ScanFace />Salvar facial</button></div></Modal>
  </div>
}
