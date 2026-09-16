import { Filter, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingState from '../components/LoadingState'
import OccurrenceCard, { formatDate } from '../components/OccurrenceCard'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import { useOccurrences } from '../context/OccurrencesContext'

export default function OccurrencesPage() {
  const { occurrences, loading } = useOccurrences()
  const [search, setSearch] = useState('')
  const [type, setType] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return occurrences.filter((item) => {
      const matchesSearch = !term || [item.bloco, item.andar, item.lado, item.descricao, item.id].join(' ').toLowerCase().includes(term)
      return matchesSearch && (type === 'todos' || item.tipo === type) && (status === 'todos' || item.status === status)
    })
  }, [occurrences, search, type, status])

  function clearFilters() {
    setSearch('')
    setType('todos')
    setStatus('todos')
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Gestão"
        title="Ocorrências"
        description="Visualize, filtre e acompanhe todas as ocorrências do condomínio."
        action={<Link className="button primary" to="/ocorrencias/nova"><Plus size={18} />Nova ocorrência</Link>}
      />

      <section className={`filters-panel ${filtersOpen ? 'is-open' : ''}`}>
        <label className="search-field">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por bloco, descrição, andar..." />
        </label>
        <button className="button secondary mobile-filter-button" onClick={() => setFiltersOpen((value) => !value)}>
          <Filter size={18} />Filtros
        </button>
        <div className="filter-selects">
          <label><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="todos">Todos os tipos</option><option value="comum">Comum</option><option value="urgente">Urgente</option></select></label>
          <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos os status</option><option value="em aberto">Em aberto</option><option value="em andamento">Em andamento</option><option value="concluída">Concluída</option><option value="incompleta">Incompleta</option><option value="resolvida">Resolvida</option></select></label>
          <button className="button ghost clear-filter" onClick={clearFilters}><X size={16} />Limpar</button>
        </div>
      </section>

      {loading ? <LoadingState /> : (
        <>
          <div className="desktop-table-wrap">
            <table className="occurrences-table">
              <thead><tr><th>ID</th><th>Local</th><th>Descrição</th><th>Tipo</th><th>Status</th><th>Criada em</th><th aria-label="Ações" /></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>#{String(item.id).padStart(3, '0')}</strong></td>
                    <td>Bloco {item.bloco}<small>{item.andar}º · Lado {item.lado}</small></td>
                    <td>{item.descricao}</td>
                    <td><StatusBadge type="type">{item.tipo}</StatusBadge></td>
                    <td><StatusBadge>{item.status}</StatusBadge></td>
                    <td>{formatDate(item.criadoEm)}</td>
                    <td><Link className="table-action" to={`/ocorrencias/${item.id}`}>Ver detalhes</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cards-list mobile-occurrence-list">
            {filtered.map((item) => <OccurrenceCard occurrence={item} key={item.id} />)}
          </div>
          {!filtered.length && <div className="empty-state"><Search size={30} /><h3>Nenhuma ocorrência encontrada</h3><p>Tente limpar ou alterar os filtros da busca.</p></div>}
          <p className="result-count">Mostrando {filtered.length} de {occurrences.length} ocorrências</p>
        </>
      )}

      <Link className="floating-action" to="/ocorrencias/nova" aria-label="Nova ocorrência"><Plus /></Link>
    </div>
  )
}
