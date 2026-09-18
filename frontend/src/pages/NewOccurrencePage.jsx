import { ArrowLeft, Check, CircleDot, ImagePlus, Info, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { useOccurrences } from '../context/OccurrencesContext'

export default function NewOccurrencePage() {
  const navigate = useNavigate()
  const { addOccurrence } = useOccurrences()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState(null)
  const [form, setForm] = useState({ bloco: 'A', andar: '1', lado: 'A', tipo: 'comum', descricao: '' })
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])

  function change(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (form.descricao.trim().length < 5) {
      setError('Descreva a ocorrência com pelo menos 5 caracteres.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await addOccurrence({ ...form, andar: Number(form.andar), descricao: form.descricao.trim() })
      navigate('/ocorrencias', { state: { message: 'Ocorrência cadastrada com sucesso.' } })
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível cadastrar a ocorrência.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page form-page">
      <Link className="back-link" to="/ocorrencias"><ArrowLeft size={17} />Voltar para ocorrências</Link>
      <PageHeader title="Nova ocorrência" description="Preencha os dados para registrar uma nova ocorrência." />

      <form className="form-card" onSubmit={submit}>
        <div className="creation-status-note"><span><CircleDot size={18} /></span><div><strong>Status inicial: Em aberto</strong><p>Toda nova ocorrência inicia automaticamente aguardando atendimento.</p></div><Info size={18} /></div>
        <div className="form-grid">
          <label><span>Bloco *</span><select name="bloco" value={form.bloco} onChange={change}><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
          <label><span>Andar *</span><input name="andar" type="number" min="0" max="99" value={form.andar} onChange={change} /></label>
          <label><span>Lado *</span><select name="lado" value={form.lado} onChange={change}><option>A</option><option>B</option><option>C</option></select></label>
          <label><span>Tipo *</span><select name="tipo" value={form.tipo} onChange={change}><option value="comum">Comum</option><option value="urgente">Urgente</option></select></label>
          <label className="full-field"><span>Descrição *</span><textarea name="descricao" maxLength="500" rows="6" value={form.descricao} onChange={change} placeholder="Descreva o problema e informe o local com detalhes..." /><small>{form.descricao.length}/500</small></label>
        </div>

        <div className="photo-field">
          <div><strong>Foto do local</strong><span>Opcional — a API de fotos será conectada pelo backend.</span></div>
          {preview ? (
            <div className="photo-preview"><img src={preview} alt="Prévia do local" /><button type="button" onClick={() => setPhoto(null)} aria-label="Remover foto"><X size={17} /></button></div>
          ) : (
            <label className="photo-picker"><ImagePlus size={24} /><span>Selecionar foto</span><input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /></label>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <Link className="button secondary" to="/ocorrencias">Cancelar</Link>
          <button className="button primary" disabled={saving} type="submit">{saving ? <span className="button-spinner" /> : <Check size={18} />}{saving ? 'Cadastrando...' : 'Cadastrar ocorrência'}</button>
        </div>
      </form>
    </div>
  )
}
