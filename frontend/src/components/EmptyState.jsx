import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title = 'Nenhum registro encontrado', description = 'Tente alterar os filtros ou faça um novo cadastro.' }) {
  return <div className="empty-state"><span><Icon size={28} /></span><h3>{title}</h3><p>{description}</p></div>
}
