import { Download, FileCheck2, FileText, FolderOpen, Plus, Search, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import DemoBanner from '../components/DemoBanner'
import { useData } from '../context/DataContext'

const date = (value) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))

export default function DocumentsPage() {
  const { documents, createDocument } = useData()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const list = useMemo(() => documents.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [documents, search])
  function submit(event) {
    event.preventDefault()
    createDocument(Object.fromEntries(new FormData(event.currentTarget)))
    setModal(false)
  }
  return <div className="page">
    <PageHeader eyebrow="Governança digital" title="Central de documentos" description="Atas, regulamentos, laudos, contratos e prestação de contas com controle de versão." action={<button className="button primary" onClick={() => setModal(true)}><Plus />Adicionar documento</button>} />
    <DemoBanner title="Central documental e versionamento estão em avaliação" />
    <section className="suite-stats"><div><FolderOpen /><span><small>Arquivos</small><strong>{documents.length}</strong></span></div><div><FileCheck2 /><span><small>Atualizados</small><strong>{documents.filter((item) => item.version >= 1).length}</strong></span></div><div><ShieldCheck /><span><small>Restritos à gestão</small><strong>{documents.filter((item) => item.visibility === 'Gestão').length}</strong></span></div><div><FileText /><span><small>Categorias</small><strong>{new Set(documents.map((item) => item.category)).size}</strong></span></div></section>
    <section className="panel"><div className="filters-row"><label className="suite-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento..." /></label></div><div className="document-grid">{list.map((item) => <article key={item.id}><span className="document-icon"><FileText /></span><div><Badge tone="blue">{item.category}</Badge><h3>{item.name}</h3><p>{item.size || 'Arquivo externo'} · versão {item.version}</p><small>{item.uploadedBy} · {date(item.uploadedAt)}</small></div><footer><span><ShieldCheck />{item.visibility}</span><button title="Download demonstrativo"><Download /></button></footer></article>)}</div></section>
    <Modal open={modal} onClose={() => setModal(false)} title="Adicionar documento"><form className="form-layout" onSubmit={submit}><label className="span-2"><span>Nome do arquivo *</span><input name="name" required placeholder="Documento.pdf" /></label><label><span>Categoria</span><select name="category"><option>Atas</option><option>Regulamento</option><option>Contratos</option><option>Laudos</option><option>Financeiro</option></select></label><label><span>Visibilidade</span><select name="visibility"><option>Moradores</option><option>Gestão</option><option>Funcionários</option></select></label><label><span>Tamanho</span><input name="size" placeholder="2,4 MB" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(false)}>Cancelar</button><button className="button primary">Salvar documento</button></div></form></Modal>
  </div>
}
