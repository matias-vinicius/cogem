import { Bell, Building2, Check, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'

const PROFILE_KEY = 'cogem_profile_preferences_v1'

function readPreferences() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || { email: true, push: true, digest: false } } catch { return { email: true, push: true, digest: false } }
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState(readPreferences)
  const [saved, setSaved] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')

  function savePreferences(event) {
    event.preventDefault(); localStorage.setItem(PROFILE_KEY, JSON.stringify(preferences)); setSaved(true); setTimeout(() => setSaved(false), 2200)
  }

  function requestPassword(event) {
    event.preventDefault(); setPasswordMessage('Solicitação registrada. Ao conectar a API, o link será enviado por e-mail.')
  }

  return <div className="page"><PageHeader back eyebrow="Conta" title="Meu perfil" description="Consulte sua identificação e personalize seus avisos." />
    <div className="profile-grid">
      <section className="panel profile-card"><div className="profile-avatar"><UserRound size={32} /></div><h2>{user.name}</h2><span>{ROLE_LABELS[user.role]}</span><div className="profile-details"><p><Mail size={16} /><span><small>E-mail</small>{user.email}</span></p><p><Building2 size={16} /><span><small>Unidade / setor</small>{user.unit}</span></p><p><ShieldCheck size={16} /><span><small>Nível de acesso</small>{ROLE_LABELS[user.role]}</span></p></div></section>
      <section className="panel profile-preferences"><header><Bell size={20} /><div><h2>Minhas notificações</h2><p>Preferências salvas somente para este navegador.</p></div></header><form onSubmit={savePreferences} className="settings-toggles"><label><span><strong>Avisos por e-mail</strong><small>Receber comunicados e atualizações.</small></span><input type="checkbox" checked={preferences.email} onChange={(event) => setPreferences({ ...preferences, email: event.target.checked })} /></label><label><span><strong>Alertas na aplicação</strong><small>Exibir pendências no sino do sistema.</small></span><input type="checkbox" checked={preferences.push} onChange={(event) => setPreferences({ ...preferences, push: event.target.checked })} /></label><label><span><strong>Resumo semanal</strong><small>Resumo consolidado da sua unidade.</small></span><input type="checkbox" checked={preferences.digest} onChange={(event) => setPreferences({ ...preferences, digest: event.target.checked })} /></label><div className="profile-form-action">{saved && <span><Check size={16} />Preferências salvas</span>}<button className="button primary">Salvar preferências</button></div></form></section>
      <section className="panel profile-password"><header><LockKeyhole size={20} /><div><h2>Segurança da conta</h2><p>A alteração definitiva será feita pela API de autenticação.</p></div></header><form onSubmit={requestPassword}><label><span>Confirme seu e-mail</span><input type="email" defaultValue={user.email} required /></label>{passwordMessage && <div className="form-info"><Check size={17} /><span>{passwordMessage}</span></div>}<button className="button secondary">Solicitar troca de senha</button></form></section>
    </div>
  </div>
}
