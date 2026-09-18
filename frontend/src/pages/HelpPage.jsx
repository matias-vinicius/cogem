import { CircleHelp, ExternalLink } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SettingsBackLink from '../components/SettingsBackLink'

const questions = [
  ['Como cadastrar uma ocorrência?', 'Abra “Nova ocorrência”, informe bloco, andar, lado, tipo e descrição. Ao cadastrar, ela será criada automaticamente com o status “em aberto”.'],
  ['Como iniciar um atendimento?', 'Abra a ocorrência na lista, clique em “Alterar status” e avance de “em aberto” para “em andamento”.'],
  ['Como finalizar uma ocorrência?', 'Depois que estiver “em andamento”, altere para “concluída” em ocorrências comuns ou “resolvida” em ocorrências urgentes.'],
  ['Por que não consigo escolher qualquer status?', 'O COGEM bloqueia mudanças fora da ordem para manter o histórico e o processo de atendimento corretos.'],
  ['Por que aparece “API desconectada”?', 'Confirme se o backend está executando em http://127.0.0.1:8000 e depois atualize a página.'],
]

export default function HelpPage() {
  return (
    <div className="page settings-subpage">
      <SettingsBackLink />
      <PageHeader eyebrow="Suporte" title="Central de ajuda" description="Respostas rápidas para utilizar o COGEM." />
      <section className="help-card"><div className="settings-form-heading"><span className="settings-hero-icon"><CircleHelp size={26} /></span><div><strong>Perguntas frequentes</strong><p>Clique em uma pergunta para visualizar a resposta.</p></div></div><div className="faq-list">{questions.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<ExternalLink size={16} /></summary><p>{answer}</p></details>)}</div></section>
    </div>
  )
}
