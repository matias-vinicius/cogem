import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function SettingsBackLink() {
  return <Link className="back-link" to="/configuracoes"><ArrowLeft size={17} />Voltar para configurações</Link>
}
