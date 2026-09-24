import { QRCodeSVG } from 'qrcode.react'
import { BellRing, Check, Clock3, PackageCheck, QrCode, ShieldCheck } from 'lucide-react'

function stepState(index, delivered, notified) {
  if (delivered) return 'complete'
  if (index === 0 || (index === 1 && notified)) return 'complete'
  if (index === 2) return 'current'
  return 'pending'
}

export default function PackageDigitalPass({ item, pickupUrl, compact = false }) {
  if (!item) return null
  const delivered = item.status === 'entregue'
  const notified = ['enviado', 'simulado'].includes(item.notificationStatus?.whatsapp) || ['enviado', 'simulado'].includes(item.notificationStatus?.email)
  const steps = [
    ['Volume recebido', PackageCheck],
    ['Morador avisado', BellRing],
    [delivered ? 'Retirada validada' : 'Aguardando retirada', Clock3],
    ['Baixa auditada', ShieldCheck],
  ]

  return <section className={`digital-pass ${compact ? 'is-compact' : ''} ${delivered ? 'is-delivered' : ''}`}>
    <header>
      <div><span className="digital-pass-logo"><QrCode /></span><span><strong>COGEM PASS</strong><small>Credencial digital de retirada</small></span></div>
      <span className="pass-security"><ShieldCheck />Token de uso único</span>
    </header>
    <div className="digital-pass-content">
      <div className="pass-qr-wrap">
        <span className="pass-corner corner-a" /><span className="pass-corner corner-b" /><span className="pass-corner corner-c" /><span className="pass-corner corner-d" />
        <div className="pass-qr-code"><QRCodeSVG value={pickupUrl} size={compact ? 138 : 178} level="H" includeMargin /></div>
        <span className="pass-scan-line" />
      </div>
      <div className="pass-identity">
        <span className="pass-label">Protocolo verificado</span>
        <strong>#{item.protocol || item.id}</strong>
        <dl><div><dt>Unidade</dt><dd>{item.unit}</dd></div><div><dt>Destinatário</dt><dd>{item.recipient}</dd></div><div><dt>Status</dt><dd>{delivered ? 'Entregue' : 'Pronto para retirada'}</dd></div></dl>
        <p><ShieldCheck />Apresente esta credencial na portaria. A baixa registra operador, data, horário e método de confirmação.</p>
      </div>
    </div>
    {!compact && <div className="pass-journey">{steps.map(([label, Icon], index) => <div className={stepState(index, delivered, notified)} key={label}><span>{stepState(index, delivered, notified) === 'complete' ? <Check /> : <Icon />}</span><small>{label}</small></div>)}</div>}
    <footer><span>CHAVE SEGURA</span><code>{item.pickupToken || 'TOKEN GERADO PELO BACKEND'}</code><small>{delivered ? 'Credencial encerrada' : 'Expira automaticamente após a confirmação'}</small></footer>
  </section>
}
