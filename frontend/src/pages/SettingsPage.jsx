import { Bell, ChevronRight, CircleHelp, CircleUserRound, Database, Info, ShieldCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useOccurrences } from '../context/OccurrencesContext'

export default function SettingsPage() {
  const { apiError } = useOccurrences()
  const options = [
    { icon: CircleUserRound, title: 'Perfil', description: 'Dados do administrador' },
    { icon: Bell, title: 'Notificações', description: 'Preferências de avisos' },
    { icon: ShieldCheck, title: 'Regras de status', description: 'Fluxos de ocorrências comuns e urgentes' },
    { icon: CircleHelp, title: 'Ajuda', description: 'Orientações de uso do sistema' },
    { icon: Info, title: 'Sobre o COGEM', description: 'Versão 0.1.0' },
  ]

  return (
    <div className="page settings-page">
      <PageHeader eyebrow="Sistema" title="Configurações" description="Gerencie preferências e consulte informações do COGEM." />
      <section className="profile-card"><div className="avatar"><CircleUserRound size={42} /></div><div><h2>Administrador</h2><p>admin@cogem.com</p></div><span className={`connection-status ${apiError ? 'offline' : ''}`}><Database size={16} />{apiError ? 'API desconectada' : 'API conectada'}</span></section>
      <section className="settings-list">{options.map(({ icon: Icon, title, description }) => <button key={title}><span className="settings-icon"><Icon size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} /></button>)}</section>
      <section className="brand-footer-card"><div className="brand-mark"><Database size={26} /></div><div><strong>COGEM</strong><p>Mais organização para o seu condomínio.</p></div></section>
    </div>
  )
}
