export default function StatusBadge({ children, type = 'status' }) {
  const normalized = String(children).toLowerCase().replaceAll(' ', '-').replace('í', 'i').replace('ú', 'u')
  return <span className={`badge ${type}-${normalized}`}>{children}</span>
}
