import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, onClose, title, description, children, size = 'medium' }) {
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    document.body.classList.add('modal-open')
    return () => {
      window.removeEventListener('keydown', close)
      document.body.classList.remove('modal-open')
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}
