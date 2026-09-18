import { Bell, Check } from 'lucide-react'
import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import SettingsBackLink from '../components/SettingsBackLink'
import { useSettings } from '../context/SettingsContext'

const notificationOptions = [
  { key: 'newOccurrence', title: 'Novas ocorrências', description: 'Avisar quando uma ocorrência for cadastrada.' },
  { key: 'statusChanges', title: 'Alterações de status', description: 'Avisar quando o andamento de uma ocorrência mudar.' },
  { key: 'urgentOccurrence', title: 'Ocorrências urgentes', description: 'Destacar avisos de prioridade urgente.' },
  { key: 'browser', title: 'Notificações do navegador', description: 'Permitir que o navegador mostre avisos do COGEM.' },
]

export default function NotificationsSettingsPage() {
  const { notifications, saveNotifications } = useSettings()
  const [form, setForm] = useState(notifications)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function toggle(key) {
    setError('')
    if (key === 'browser' && !form.browser) {
      if (!('Notification' in window)) return setError('Este navegador não suporta notificações.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setError('A permissão de notificações não foi concedida.')
    }
    setForm((current) => ({ ...current, [key]: !current[key] }))
  }

  function submit(event) {
    event.preventDefault()
    saveNotifications(form)
    setMessage('Preferências salvas com sucesso.')
  }

  return (
    <div className="page settings-subpage">
      <SettingsBackLink />
      <PageHeader eyebrow="Configurações" title="Notificações" description="Escolha quais avisos deseja receber." />
      <form className="form-card" onSubmit={submit}>
        <div className="settings-form-heading"><span className="settings-hero-icon"><Bell size={26} /></span><div><strong>Preferências de avisos</strong><p>Você pode alterar essas opções a qualquer momento.</p></div></div>
        <div className="toggle-list">
          {notificationOptions.map((option) => (
            <button className="toggle-row" key={option.key} type="button" onClick={() => toggle(option.key)}>
              <span><strong>{option.title}</strong><small>{option.description}</small></span>
              <span className={`switch ${form[option.key] ? 'is-on' : ''}`} aria-label={form[option.key] ? 'Ativado' : 'Desativado'}><i /></span>
            </button>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <div className="form-actions"><button className="button primary" type="submit"><Check size={18} />Salvar preferências</button></div>
      </form>
    </div>
  )
}
