import { Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROLE_LABELS } from '../config/permissions'
import { useAuth } from '../context/AuthContext'

const demoRoles = [
  { role: 'admin', label: 'Administrador', description: 'Acesso completo' },
  { role: 'manager', label: 'Síndico', description: 'Gestão do condomínio' },
  { role: 'concierge', label: 'Portaria', description: 'Operação e acessos' },
  { role: 'maintenance', label: 'Manutenção', description: 'Ocorrências e estoque' },
  { role: 'resident', label: 'Morador', description: 'Serviços da unidade' },
]

export default function LoginPage() {
  const { login, loginAs } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('admin@cogem.com')
  const [password, setPassword] = useState('123456')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)

  function finishLogin() {
    navigate(location.state?.from || '/', { replace: true })
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true); setError('')
    try { login(email, password); finishLogin() } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  function enterAs(role) {
    setError('')
    try { loginAs(role); finishLogin() } catch (err) { setError(err.message) }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-brand"><span><Building2 size={30} /></span><div><strong>COGEM</strong><small>Gestão inteligente para condomínios</small></div></div>
        <div className="login-message"><span className="eyebrow light">Operação centralizada</span><h1>Seu condomínio conectado, organizado e seguro.</h1><p>Ocorrências, portaria, encomendas, visitantes, estoque e acessos em um único sistema.</p><ul><li><CheckCircle2 />Informações em tempo real</li><li><CheckCircle2 />Perfis com níveis de acesso</li><li><CheckCircle2 />Interface responsiva e intuitiva</li></ul></div>
        <div className="login-shape shape-one" /><div className="login-shape shape-two" />
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-logo"><Building2 size={26} /><strong>COGEM</strong></div>
          <span className="login-icon"><ShieldCheck size={25} /></span><h2>Bem-vindo de volta</h2><p>Acesse sua conta para continuar.</p>
          <form onSubmit={submit}>
            <label><span>E-mail</span><div className="input-with-icon"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required /></div></label>
            <label><span>Senha</span><div className="input-with-icon"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            <div className="login-options"><label className="checkbox-label"><input type="checkbox" defaultChecked />Lembrar acesso</label><button className="link-button" type="button" onClick={() => setRecovery(true)}>Esqueci minha senha</button></div>
            {recovery && <div className="form-info"><CheckCircle2 size={17} /><span><strong>Recuperação preparada</strong>No modo local, use a senha 123456. Com a API conectada, o link será enviado por e-mail.</span></div>}
            {error && <p className="form-error">{error}</p>}
            <button className="button primary login-submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar no sistema'}</button>
          </form>
          <div className="demo-access"><span>Acesso demonstrativo</span><div>{demoRoles.map((item) => <button key={item.role} onClick={() => enterAs(item.role)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div><p>Senha padrão: <strong>123456</strong></p></div>
          <small className="login-note">Os níveis de acesso do frontend são demonstrativos. A segurança definitiva será validada pela API.</small>
        </div>
      </section>
    </main>
  )
}
