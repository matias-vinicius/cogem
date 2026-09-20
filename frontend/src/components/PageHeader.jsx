import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ eyebrow, title, description, action, back = false }) {
  const navigate = useNavigate()
  return (
    <header className="page-header">
      <div className="page-heading">
        {back && <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={17} />Voltar</button>}
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  )
}
