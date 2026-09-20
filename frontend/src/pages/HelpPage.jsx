import { BookOpenText, Boxes, ClipboardList, HelpCircle, KeyRound, Mail, Package, Phone, ShieldCheck, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'

const topics = [
  { icon: ClipboardList, title: 'Ocorrências', text: 'Cadastre uma solicitação. Ela nasce em aberto e segue o fluxo definido pelo tipo.' },
  { icon: Package, title: 'Encomendas', text: 'Registre o recebimento e confirme quem retirou o volume na portaria.' },
  { icon: Users, title: 'Visitantes', text: 'Autorize a pessoa e use os botões de entrada e saída para manter o acesso atualizado.' },
  { icon: KeyRound, title: 'Chaves', text: 'Controle o responsável, finalidade, retirada e devolução de cada chave.' },
  { icon: Boxes, title: 'Estoque', text: 'Cadastre materiais e faça entradas ou baixas com motivo registrado.' },
  { icon: ShieldCheck, title: 'Perfis', text: 'Cada função visualiza apenas os módulos previstos na matriz de acesso.' },
]

export default function HelpPage() {
  return <div className="page"><PageHeader back eyebrow="Suporte" title="Central de ajuda" description="Orientações rápidas para operar o COGEM." />
    <section className="help-grid">{topics.map(({ icon: Icon, title, text }) => <article className="panel help-card" key={title}><span><Icon size={21} /></span><h2>{title}</h2><p>{text}</p></article>)}</section>
    <section className="panel support-card"><div><span className="support-icon"><HelpCircle size={24} /></span><div><span className="eyebrow">Precisa de apoio?</span><h2>Fale com a administração</h2><p>Use os canais internos do condomínio para dúvidas, cadastros e acessos.</p></div></div><div><a href="mailto:admin@cogem.com"><Mail size={17} />admin@cogem.com</a><a href="tel:+551140000000"><Phone size={17} />(11) 4000-0000</a><a href="mailto:admin@cogem.com?subject=Suporte%20COGEM"><BookOpenText size={17} />Abrir chamado</a></div></section>
  </div>
}
