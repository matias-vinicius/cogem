import { Plus, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import SearchField from '../components/SearchField'
import { ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

export default function UsersPage() {
  const { user: session } = useAuth()
  const { users, createUser, toggleUser } = useData()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('todos')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => users.filter((item) => (role === 'todos' || item.role === role) && `${item.name} ${item.email} ${item.unit} ${ROLE_LABELS[item.role]}`.toLowerCase().includes(search.toLowerCase())), [users, search, role])
  function submit(event) { event.preventDefault(); createUser(Object.fromEntries(new FormData(event.currentTarget).entries())); setOpen(false) }
  return <div className="page"><PageHeader eyebrow="Administração" title="Usuários e acessos" description="Gerencie contas, funções e disponibilidade de acesso." action={<button className="button primary" onClick={() => setOpen(true)}><Plus size={17} />Novo usuário</button>} />
    <section className="mini-stats"><div><Users /><span>Total de usuários<strong>{users.length}</strong></span></div><div><UserCheck /><span>Ativos<strong>{users.filter((item) => item.active).length}</strong></span></div><div><ShieldCheck /><span>Administradores<strong>{users.filter((item) => ['admin', 'manager'].includes(item.role)).length}</strong></span></div></section>
    <section className="panel list-panel"><div className="filters-row"><SearchField value={search} onChange={setSearch} placeholder="Buscar nome, e-mail ou unidade..." /><select value={role} onChange={(event) => setRole(event.target.value)}><option value="todos">Todos os perfis</option>{Object.entries(ROLE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>{filtered.length === 0 ? <EmptyState icon={Users} /> : <div className="responsive-table"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Unidade/setor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td data-label="Usuário"><div className="user-cell"><span>{item.name.charAt(0)}</span><div><strong>{item.name}</strong><small>{item.email}</small></div></div></td><td data-label="Perfil"><Badge tone={item.role}>{ROLE_LABELS[item.role]}</Badge></td><td data-label="Unidade/setor">{item.unit}</td><td data-label="Status"><Badge tone={item.active ? 'ativo' : 'inativo'}>{item.active ? 'ativo' : 'inativo'}</Badge></td><td data-label="Ação"><button className={`table-button ${item.active ? 'danger' : 'success'}`} disabled={item.id === session.id} onClick={() => toggleUser(item.id)}>{item.active ? <><UserX size={14} />Desativar</> : <><UserCheck size={14} />Ativar</>}</button></td></tr>)}</tbody></table></div>}</section>
    <Modal open={open} onClose={() => setOpen(false)} title="Novo usuário" description="A senha poderá ser alterada após a integração com o backend."><form className="form-layout" onSubmit={submit}><label><span>Nome completo *</span><input name="name" required /></label><label><span>E-mail *</span><input name="email" type="email" required /></label><label><span>Perfil de acesso *</span><select name="role">{Object.entries(ROLE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Unidade/setor *</span><input name="unit" required /></label><label className="span-2"><span>Senha provisória *</span><input name="password" type="password" required minLength="6" defaultValue="123456" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="button primary">Criar usuário</button></div></form></Modal>
  </div>
}
