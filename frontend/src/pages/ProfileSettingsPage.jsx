import { Check, UserRound } from 'lucide-react'
import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import SettingsBackLink from '../components/SettingsBackLink'
import { useSettings } from '../context/SettingsContext'

export default function ProfileSettingsPage() {
  const { profile, saveProfile } = useSettings()
  const [form, setForm] = useState(profile)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function change(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function submit(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (form.name.trim().length < 3) return setError('Informe um nome com pelo menos 3 caracteres.')
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Informe um e-mail válido.')
    saveProfile(form)
    setMessage('Perfil salvo com sucesso.')
  }

  return (
    <div className="page settings-subpage">
      <SettingsBackLink />
      <PageHeader eyebrow="Configurações" title="Perfil" description="Atualize os dados exibidos no sistema." />
      <form className="form-card" onSubmit={submit}>
        <div className="settings-form-heading"><span className="settings-hero-icon"><UserRound size={26} /></span><div><strong>Dados do administrador</strong><p>Essas informações ficam salvas neste navegador.</p></div></div>
        <div className="form-grid">
          <label><span>Nome *</span><input name="name" value={form.name} onChange={change} maxLength="60" /></label>
          <label><span>E-mail *</span><input name="email" type="email" value={form.email} onChange={change} maxLength="100" /></label>
          <label><span>Telefone</span><input name="phone" value={form.phone} onChange={change} placeholder="(11) 99999-9999" maxLength="20" /></label>
          <label><span>Cargo</span><input name="role" value={form.role} onChange={change} maxLength="60" /></label>
          <label className="full-field"><span>Condomínio</span><input name="condominium" value={form.condominium} onChange={change} maxLength="80" /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <div className="form-actions"><button className="button primary" type="submit"><Check size={18} />Salvar alterações</button></div>
      </form>
    </div>
  )
}
