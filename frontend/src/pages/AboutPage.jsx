import { Building2, CheckCircle2, Code2, Database } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SettingsBackLink from '../components/SettingsBackLink'

export default function AboutPage() {
  return (
    <div className="page settings-subpage">
      <SettingsBackLink />
      <PageHeader eyebrow="Sistema" title="Sobre o COGEM" description="Informações da plataforma de gestão de ocorrências." />
      <section className="about-card"><div className="about-brand"><span><Building2 size={34} /></span><div><h2>COGEM</h2><p>Gestão de Ocorrências em Condomínios</p></div></div><div className="about-grid"><div><Code2 /><span>Versão<strong>0.2.0</strong></span></div><div><Database /><span>Integração<strong>FastAPI + SQLite</strong></span></div><div><CheckCircle2 /><span>Frontend<strong>React + Vite</strong></span></div></div><p className="about-copy">Uma solução para registrar, acompanhar e organizar atendimentos de manutenção em condomínios com clareza e agilidade.</p></section>
    </div>
  )
}
