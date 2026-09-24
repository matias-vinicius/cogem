import { FlaskConical, MessageSquareText, Sparkles } from 'lucide-react'

export default function DemoBanner({
  title = 'Recurso em fase de testes',
  description = 'Use normalmente para conhecer o fluxo. Esta funcionalidade está em validação e pode receber melhorias antes do lançamento oficial.',
}) {
  return <section className="demo-banner" role="status">
    <span className="demo-banner-icon"><FlaskConical /></span>
    <div>
      <span className="demo-kicker"><Sparkles />BETA · VERSÃO DEMONSTRATIVA</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
    <span className="demo-feedback"><MessageSquareText />Feedback bem-vindo</span>
  </section>
}
