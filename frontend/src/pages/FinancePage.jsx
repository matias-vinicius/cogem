import { Banknote, Barcode, CalendarDays, CheckCircle2, CircleDollarSign, Copy, Plus, ReceiptText, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import Badge from '../components/Badge'
import DemoBanner from '../components/DemoBanner'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import { useData } from '../context/DataContext'

const money = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = (value) => new Intl.DateTimeFormat('pt-BR').format(new Date(value))
const monthly = [62, 68, 73, 77, 81, 84, 82, 87, 89, 92, 91, 96]

export default function FinancePage() {
  const { charges, createCharge, markChargePaid } = useData()
  const [modal, setModal] = useState(false)
  const totals = useMemo(() => ({
    receivable: charges.filter((item) => item.status !== 'pago').reduce((sum, item) => sum + item.amount, 0),
    received: charges.filter((item) => item.status === 'pago').reduce((sum, item) => sum + item.amount, 0),
    overdue: charges.filter((item) => item.status === 'vencido').reduce((sum, item) => sum + item.amount, 0),
  }), [charges])

  function submit(event) {
    event.preventDefault()
    createCharge(Object.fromEntries(new FormData(event.currentTarget)))
    setModal(false)
  }

  return <div className="page finance-page">
    <PageHeader eyebrow="Transparência financeira · acesso do síndico" title="Gestão financeira" description="Cobranças, vencimentos e controle financeiro do condomínio." action={<button className="button primary" onClick={() => setModal(true)}><Plus size={17} />Nova cobrança</button>} />
    <DemoBanner title="Gestão financeira em fase de testes" description="Registre e acompanhe valores reais para controle. PIX, boletos e pagamentos automáticos dependem de integração bancária segura no back-end." />

    <section className="suite-stats finance-stats">
      <div><CircleDollarSign /><span><small>Receita prevista</small><strong>{money(totals.receivable + totals.received)}</strong></span></div>
      <div><CheckCircle2 /><span><small>Recebido</small><strong>{money(totals.received)}</strong></span></div>
      <div><ReceiptText /><span><small>Em aberto</small><strong>{money(Math.max(0, totals.receivable - totals.overdue))}</strong></span></div>
      <div><TriangleAlert /><span><small>Inadimplência</small><strong>{money(totals.overdue)}</strong></span></div>
    </section>

    <section className="finance-overview-grid">
      <article className="panel finance-chart-panel">
        <header className="panel-header compact-panel-header"><div><span className="eyebrow">Evolução</span><h2>Receitas mensais</h2></div><span className="period-pill"><CalendarDays size={15} />2026</span></header>
        <div className="finance-chart" role="img" aria-label="Gráfico demonstrativo de receitas mensais">{monthly.map((value, index) => <div key={value + index}><span><i style={{ height: `${value * 1.35}px` }} /><b style={{ height: `${Math.max(20, value - 12) * 1.35}px` }} /></span><small>{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][index]}</small></div>)}</div>
        <footer className="chart-legend"><span><i className="legend-access" />Receita prevista</span><span><i className="legend-received" />Recebido</span></footer>
      </article>

      <article className="panel finance-list-panel">
        <header className="panel-header compact-panel-header"><div><span className="eyebrow">Competência atual</span><h2>Últimas cobranças</h2></div><span className="finance-count">{charges.length} registros</span></header>
        <div className="responsive-table finance-table"><table><thead><tr><th>Unidade</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{charges.map((item) => <tr key={item.id}><td data-label="Unidade"><strong>{item.unit}</strong><small>{item.resident}</small></td><td data-label="Vencimento">{date(item.dueAt)}</td><td data-label="Valor"><strong>{money(item.amount)}</strong></td><td data-label="Status"><Badge>{item.status}</Badge></td><td data-label="Ações"><div className="table-actions">{item.barcode && <button className="table-button" title="Copiar linha digitável" onClick={() => navigator.clipboard?.writeText(item.barcode)}><Copy size={13} /></button>}{item.status !== 'pago' && <button className="table-button success" title="Registrar pagamento" onClick={() => markChargePaid(item.id)}><Banknote size={13} /></button>}</div></td></tr>)}</tbody></table></div>
      </article>
    </section>

    <section className="finance-note"><Barcode /><div><strong>Integração bancária prevista</strong><p>PIX, boleto, CNAB, conciliação e baixa automática dependerão do provedor financeiro contratado no back-end.</p></div></section>

    <Modal open={modal} onClose={() => setModal(false)} title="Nova cobrança"><form className="form-layout" onSubmit={submit}><label><span>Unidade *</span><input name="unit" required /></label><label><span>Morador *</span><input name="resident" required /></label><label className="span-2"><span>Descrição *</span><input name="description" required /></label><label><span>Valor *</span><input name="amount" type="number" step="0.01" required /></label><label><span>Vencimento</span><input name="dueAt" type="date" required /></label><label className="span-2"><span>Linha digitável</span><input name="barcode" /></label><div className="modal-actions span-2"><button type="button" className="button secondary" onClick={() => setModal(false)}>Cancelar</button><button className="button primary">Gerar cobrança</button></div></form></Modal>
  </div>
}
