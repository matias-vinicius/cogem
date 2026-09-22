function slug(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-')
}

export default function Badge({ children, tone }) {
  return <span className={`badge badge-${tone || slug(children)}`}>{children}</span>
}
