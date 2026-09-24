import { BellRing, CalendarClock, CheckCircle2, Megaphone, MessageSquareText, Plus, Send, Users } from 'lucide-react'
import { useState } from 'react'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import DemoBanner from '../components/DemoBanner'
import { useData } from '../context/DataContext'

const date = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

export default function CommunicationsPage() {
  const { announcements, polls, createAnnouncement, createPoll, votePoll } = useData()
  const [modal, setModal] = useState(null)
  function publish(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createAnnouncement(Object.fromEntries(form))
    setModal(null)
  }
  function createVote(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createPoll({ title: form.get('title'), question: form.get('question'), endsAt: form.get('endsAt'), options: [form.get('option1'), form.get('option2'), form.get('option3')] })
    setModal(null)
  }
  return <div className="page">
    <PageHeader eyebrow="Comunidade conectada" title="Comunicação" description="Comunicados oficiais, segmentação de público, confirmações de leitura e enquetes." action={<div className="header-actions"><button className="button secondary" onClick={() => setModal('poll')}><MessageSquareText />Nova enquete</button><button className="button primary" onClick={() => setModal('announcement')}><Plus />Publicar comunicado</button></div>} />
    <DemoBanner title="Comunicação segmentada e enquetes estão em avaliação" />
    <section className="suite-stats"><div><Megaphone /><span><small>Comunicados</small><strong>{announcements.length}</strong></span></div><div><BellRing /><span><small>Prioritários</small><strong>{announcements.filter((item) => item.priority === 'importante').length}</strong></span></div><div><MessageSquareText /><span><small>Enquetes ativas</small><strong>{polls.filter((item) => item.status === 'ativa').length}</strong></span></div><div><Users /><span><small>Alcance estimado</small><strong>96%</strong></span></div></section>
    <div className="suite-layout">
      <section className="panel"><div className="panel-header"><div><span className="eyebrow">Mural digital</span><h2>Comunicados recentes</h2></div></div><div className="announcement-list">{announcements.map((item) => <article key={item.id} className={item.priority === 'importante' ? 'important' : ''}><span className="suite-icon"><Megaphone /></span><div><header><div><h3>{item.title}</h3><p>{item.category} · {item.audience}</p></div><Badge tone={item.priority === 'importante' ? 'urgent' : 'blue'}>{item.priority}</Badge></header><p>{item.content}</p><footer><span>{item.author} · {date(item.createdAt)}</span><span><CheckCircle2 />{item.readBy?.length || 0} confirmações</span></footer></div></article>)}</div></section>
      <aside className="panel"><div className="panel-header"><div><span className="eyebrow">Participação</span><h2>Enquetes</h2></div></div><div className="poll-list">{polls.map((poll) => { const selected = poll.votes?.[4]; return <article key={poll.id}><header><Badge tone="green">{poll.status}</Badge><span><CalendarClock />até {date(poll.endsAt)}</span></header><h3>{poll.title}</h3><p>{poll.question}</p><div>{poll.options.map((option) => <button key={option} className={selected === option ? 'selected' : ''} onClick={() => votePoll(poll.id, option)}><span>{option}</span>{selected === option && <CheckCircle2 />}</button>)}</div></article> })}</div></aside>
    </div>
    <Modal open={modal === 'announcement'} onClose={() => setModal(null)} title="Novo comunicado"><form className="form-layout" onSubmit={publish}><label className="span-2"><span>Título *</span><input name="title" required /></label><label><span>Categoria</span><select name="category"><option>Informativo</option><option>Manutenção</option><option>Regulamento</option><option>Emergência</option></select></label><label><span>Público</span><select name="audience"><option>Todos</option><option>Moradores</option><option>Portaria</option><option>Funcionários</option></select></label><label><span>Prioridade</span><select name="priority"><option>normal</option><option>importante</option></select></label><label className="span-2"><span>Mensagem *</span><textarea name="content" required /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary"><Send />Publicar</button></div></form></Modal>
    <Modal open={modal === 'poll'} onClose={() => setModal(null)} title="Nova enquete"><form className="form-layout" onSubmit={createVote}><label className="span-2"><span>Título *</span><input name="title" required /></label><label className="span-2"><span>Pergunta *</span><input name="question" required /></label><label><span>Opção 1 *</span><input name="option1" required /></label><label><span>Opção 2 *</span><input name="option2" required /></label><label><span>Opção 3</span><input name="option3" /></label><label><span>Encerramento</span><input type="datetime-local" name="endsAt" required /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(null)}>Cancelar</button><button className="button primary">Criar enquete</button></div></form></Modal>
  </div>
}
