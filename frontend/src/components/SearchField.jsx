import { Search, X } from 'lucide-react'

export default function SearchField({ value, onChange, placeholder = 'Buscar...' }) {
  return <label className="search-field"><Search size={17} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />{value && <button type="button" onClick={() => onChange('')} aria-label="Limpar busca"><X size={15} /></button>}</label>
}
