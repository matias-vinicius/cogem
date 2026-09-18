import { Bell, ChevronRight, CircleHelp, CircleUserRound, ClipboardList, Database, Info, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useOccurrences } from '../context/OccurrencesContext'
import { useSettings } from '../context/SettingsContext'

export default function SettingsPage() {
  const { apiError } = useOccurrences()
  const { profile } = useSettings()
  const options = [
    { icon: CircleUserRound, title: 'Perfil', description: 'Dados do administrador', to: '/configuracoes/perfil' },
    { icon: Bell, title: 'Notificações', description: 'Preferências de avisos', to: '/configuracoes/notificacoes' },
    { icon: ClipboardList, title: 'Registros', description: 'Histórico de atividades do sistema', to: '/configuracoes/registros' },
    { icon: ShieldCheck, title: 'Regras de status', description: 'Fluxos de ocorrências comuns e urgentes', to: '/configuracoes/regras' },
    { icon: CircleHelp, title: 'Ajuda', description: 'Orientações de uso do sistema', to: '/configuracoes/ajuda' },
    { icon: Info, title: 'Sobre o COGEM', description: 'Versão 0.2.0', to: '/configuracoes/sobre' },
  ]

  return (
    <div className="page settings-page">
      <PageHeader eyebrow="Sistema" title="Configurações" description="Gerencie preferências e consulte informações do COGEM." />
      <section className="profile-card"><div className="avatar"><CircleUserRound size={42} /></div><div><h2>{profile.name}</h2><p>{profile.email}</p></div><span className={`connection-status ${apiError ? 'offline' : ''}`}><Database size={16} />{apiError ? 'API desconectada' : 'API conectada'}</span></section>
      <section className="settings-list">{options.map(({ icon: Icon, title, description, to }) => <Link key={title} to={to}><span className="settings-icon"><Icon size={20} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} /></Link>)}</section>
      <section className="brand-footer-card"><div className="brand-mark"><Database size={26} /></div><div><strong>COGEM</strong><p>Mais organização para o seu condomínio.</p></div></section>
    </div>
  )
}
