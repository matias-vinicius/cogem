import { ArrowDown, CheckCircle2, CircleDot, Clock3, Info, Wrench } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SettingsBackLink from '../components/SettingsBackLink'

function FlowStep({ icon: Icon, label, tone }) {
  return <div className={`flow-step ${tone}`}><Icon size={18} /><strong>{label}</strong></div>
}

export default function StatusRulesPage() {
  return (
    <div className="page settings-subpage">
      <SettingsBackLink />
      <PageHeader eyebrow="Configurações" title="Regras de status" description="Veja o caminho permitido para cada tipo de ocorrência." />
      <div className="rules-grid">
        <section className="rule-card"><span className="rule-type common"><CircleDot size={18} />Ocorrência comum</span><div className="status-flow"><FlowStep icon={CircleDot} label="Em aberto" tone="open" /><ArrowDown /><FlowStep icon={Wrench} label="Em andamento" tone="progress" /><ArrowDown /><div className="flow-finish"><FlowStep icon={CheckCircle2} label="Concluída" tone="done" /><span>ou</span><FlowStep icon={Info} label="Incompleta" tone="incomplete" /></div></div></section>
        <section className="rule-card"><span className="rule-type urgent"><Clock3 size={18} />Ocorrência urgente</span><div className="status-flow"><FlowStep icon={CircleDot} label="Em aberto" tone="open" /><ArrowDown /><FlowStep icon={Wrench} label="Em andamento" tone="progress" /><ArrowDown /><FlowStep icon={CheckCircle2} label="Resolvida" tone="done" /></div></section>
      </div>
      <div className="info-box rules-info"><Info size={18} /><p>Uma ocorrência nova sempre começa “em aberto”. O status só pode avançar para a próxima etapa do fluxo.</p></div>
    </div>
  )
}
