export default function StatCard({ icon: Icon, label, value, helper, tone = 'blue' }) {
  return <article className={`stat-card tone-${tone}`}><span className="stat-icon"><Icon size={20} /></span><div><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div></article>
}
