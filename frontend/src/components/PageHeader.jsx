import {
  AlertTriangle, ArrowLeft, Boxes, Building2, CalendarDays, CarFront, ChevronRight,
  ClipboardList, DoorOpen, FileText, Gauge, Gavel, HelpCircle, KeyRound, Megaphone,
  Package, Radio, ReceiptText, Settings, ShieldCheck, UserRound, Users, Wrench,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const moduleMeta = {
  '/': { icon: Building2, label: 'Visão geral', tone: 'blue' },
  '/ocorrencias': { icon: AlertTriangle, label: 'Central de ocorrências', tone: 'red' },
  '/encomendas': { icon: Package, label: 'Central de encomendas', tone: 'orange' },
  '/livro-portaria': { icon: ClipboardList, label: 'Operação da portaria', tone: 'blue' },
  '/chaves': { icon: KeyRound, label: 'Custódia de chaves', tone: 'purple' },
  '/visitantes': { icon: Users, label: 'Gestão de visitantes', tone: 'green' },
  '/veiculos': { icon: CarFront, label: 'Mobilidade e garagem', tone: 'purple' },
  '/controle-acesso': { icon: DoorOpen, label: 'Segurança e acesso', tone: 'green' },
  '/estoque': { icon: Boxes, label: 'Materiais e suprimentos', tone: 'orange' },
  '/reservas': { icon: CalendarDays, label: 'Agenda de espaços', tone: 'purple' },
  '/manutencao': { icon: Wrench, label: 'Manutenção inteligente', tone: 'orange' },
  '/comunicacao': { icon: Megaphone, label: 'Comunicação oficial', tone: 'blue' },
  '/documentos': { icon: FileText, label: 'Governança documental', tone: 'purple' },
  '/assembleias': { icon: Gavel, label: 'Governança e votação', tone: 'purple' },
  '/financeiro': { icon: ReceiptText, label: 'Gestão financeira', tone: 'green' },
  '/cadastros': { icon: Gauge, label: 'Vida condominial', tone: 'orange' },
  '/usuarios': { icon: ShieldCheck, label: 'Identidades e permissões', tone: 'blue' },
  '/configuracoes': { icon: Settings, label: 'Administração do sistema', tone: 'blue' },
  '/perfil': { icon: UserRound, label: 'Conta e preferências', tone: 'blue' },
  '/ajuda': { icon: HelpCircle, label: 'Ajuda e suporte', tone: 'green' },
}

export default function PageHeader({ eyebrow, title, description, action, back = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const meta = moduleMeta[location.pathname] || { icon: Building2, label: eyebrow || 'COGEM', tone: 'blue' }
  const Icon = meta.icon
  return (
    <header className={`page-header module-hero hero-${meta.tone}`}>
      <div className="module-hero-main">
        <div className="module-breadcrumb"><span>COGEM V1</span><ChevronRight size={13} /><strong>{meta.label}</strong></div>
        <div className="module-title-row">
          <span className="module-hero-icon"><Icon size={24} /></span>
          <div className="page-heading">
            {back && <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={17} />Voltar</button>}
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
        </div>
      </div>
      <div className="module-hero-side">
        {action && <div className="page-header-action">{action}</div>}
        <div className="module-health">
          <span><Radio size={13} /><i />Atualização em tempo real</span>
          <span><ShieldCheck size={13} />Acesso protegido por perfil</span>
        </div>
      </div>
      <span className="module-hero-orbit orbit-one" />
      <span className="module-hero-orbit orbit-two" />
    </header>
  )
}
