const now = Date.now()
const hoursAgo = (hours) => new Date(now - hours * 3600000).toISOString()
const daysFromNow = (days, hour = 12) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export const demoUsers = [
  { id: 1, name: 'Administrador COGEM', email: 'admin@cogem.com', phone: '(11) 99999-0001', password: '123456', role: 'admin', unit: 'Administração', active: true, faceStatus: 'cadastrada', faceRegisteredAt: hoursAgo(120) },
  { id: 2, name: 'Marcos Oliveira', email: 'portaria@cogem.com', phone: '(11) 99999-0002', password: '123456', role: 'concierge', unit: 'Portaria', active: true, faceStatus: 'cadastrada', faceRegisteredAt: hoursAgo(96) },
  { id: 3, name: 'Carlos Mendes', email: 'manutencao@cogem.com', phone: '(11) 99999-0003', password: '123456', role: 'maintenance', unit: 'Manutenção', active: true, faceStatus: 'pendente', faceRegisteredAt: null },
  { id: 4, name: 'Ana Souza', email: 'morador@cogem.com', phone: '(11) 98888-1010', password: '123456', role: 'resident', unit: 'A-101', active: true, faceStatus: 'cadastrada', faceRegisteredAt: hoursAgo(72) },
  { id: 5, name: 'Patrícia Lima', email: 'sindico@cogem.com', phone: '(11) 97777-2020', password: '123456', role: 'manager', unit: 'Administração', active: true, faceStatus: 'cadastrada', faceRegisteredAt: hoursAgo(200) },
]

export const initialData = {
  occurrences: [
    { id: 1, title: 'Lâmpada queimada no corredor', description: 'Lâmpada do corredor do 10º andar não acende.', block: 'A', floor: 10, side: 'A', type: 'comum', status: 'em aberto', reporter: 'Ana Souza', createdAt: hoursAgo(3), updatedAt: hoursAgo(3) },
    { id: 2, title: 'Vazamento próximo ao elevador', description: 'Água acumulando ao lado do elevador social.', block: 'B', floor: 7, side: 'B', type: 'urgente', status: 'em andamento', reporter: 'Portaria', createdAt: hoursAgo(7), updatedAt: hoursAgo(2) },
    { id: 3, title: 'Interfone sem áudio', description: 'Interfone do apartamento não transmite áudio.', block: 'C', floor: 4, side: 'A', type: 'comum', status: 'concluída', reporter: 'João Lima', createdAt: hoursAgo(34), updatedAt: hoursAgo(8) },
  ],
  packages: [
    { id: 1, protocol: '202609471', recipient: 'Ana Souza', recipientEmail: 'morador@cogem.com', recipientPhone: '(11) 98888-1010', unit: 'A-101', carrier: 'Mercado Livre', tracking: 'MLB-943821', packageType: 'Sacola', keywords: 'Sacola Mercado Livre amarela', description: 'Chegou uma encomenda para sua unidade.', status: 'aguardando retirada', receivedBy: 'Marcos Oliveira', receivedAt: hoursAgo(2), deliveredAt: null, deliveredTo: '', deliveredBy: '', pickupToken: 'COGEM-PKG-001-ANA', notificationStatus: { whatsapp: 'enviado', email: 'enviado' }, notificationLog: [{ id: 11, channel: 'WhatsApp', status: 'enviado', createdAt: hoursAgo(2), sentBy: 'Marcos Oliveira' }, { id: 12, channel: 'E-mail', status: 'enviado', createdAt: hoursAgo(2), sentBy: 'Marcos Oliveira' }], comments: [{ id: 13, text: 'Volume armazenado no armário 03.', author: 'Marcos Oliveira', createdAt: hoursAgo(2) }] },
    { id: 2, protocol: '202609468', recipient: 'Bruno Santos', recipientEmail: 'bruno@email.com', recipientPhone: '(11) 98888-7070', unit: 'B-704', carrier: 'Correios', tracking: 'BR928430', packageType: 'Envelope', keywords: 'Envelope branco pequeno', description: 'Documento entregue pelos Correios.', status: 'aguardando retirada', receivedBy: 'Marcos Oliveira', receivedAt: hoursAgo(5), deliveredAt: null, deliveredTo: '', deliveredBy: '', pickupToken: 'COGEM-PKG-002-BRU', notificationStatus: { whatsapp: 'enviado', email: 'enviado' }, notificationLog: [{ id: 21, channel: 'WhatsApp + E-mail', status: 'enviado', createdAt: hoursAgo(5), sentBy: 'Marcos Oliveira' }], comments: [] },
    { id: 3, protocol: '202609440', recipient: 'Camila Alves', recipientEmail: 'camila@email.com', recipientPhone: '(11) 98888-4020', unit: 'C-402', carrier: 'Amazon', tracking: 'AMZ-115920', packageType: 'Caixa', keywords: 'Caixa Amazon pequena', description: 'Caixa pequena recebida sem avarias.', status: 'entregue', receivedBy: 'Portaria', receivedAt: hoursAgo(27), deliveredAt: hoursAgo(21), deliveredTo: 'Camila Alves', deliveredBy: 'Marcos Oliveira', deliveryMethod: 'qr-code', pickupToken: 'COGEM-PKG-003-CAM', notificationStatus: { whatsapp: 'enviado', email: 'enviado' }, notificationLog: [{ id: 31, channel: 'WhatsApp + E-mail', status: 'enviado', createdAt: hoursAgo(27), sentBy: 'Portaria' }], comments: [] },
    { id: 4, protocol: '202609439', recipient: 'Diego Ribeiro', recipientEmail: 'diego@email.com', recipientPhone: '(11) 95555-1202', unit: 'A-1202', carrier: 'Shopee', tracking: 'SPX-880023', packageType: 'Pacote', keywords: 'Pacote Shopee cinza', description: 'Pacote médio lacrado.', status: 'aguardando retirada', receivedBy: 'Marcos Oliveira', receivedAt: hoursAgo(8), deliveredAt: null, deliveredTo: '', deliveredBy: '', pickupToken: 'COGEM-PKG-004-DIE', notificationStatus: { whatsapp: 'enviado', email: 'simulado' }, notificationLog: [{ id: 41, channel: 'WhatsApp', status: 'enviado', createdAt: hoursAgo(8), sentBy: 'Marcos Oliveira' }], comments: [] },
    { id: 5, protocol: '202609427', recipient: 'Elisa Nogueira', recipientEmail: 'elisa@email.com', recipientPhone: '(11) 94444-3050', unit: 'B-305', carrier: 'Loggi', tracking: 'LG-223190', packageType: 'Caixa', keywords: 'Caixa parda grande', description: 'Caixa grande recebida pela portaria.', status: 'aguardando retirada', receivedBy: 'Marcos Oliveira', receivedAt: hoursAgo(12), deliveredAt: null, deliveredTo: '', deliveredBy: '', pickupToken: 'COGEM-PKG-005-ELI', notificationStatus: { whatsapp: 'enviado', email: 'enviado' }, notificationLog: [{ id: 51, channel: 'WhatsApp + E-mail', status: 'enviado', createdAt: hoursAgo(12), sentBy: 'Marcos Oliveira' }], comments: [] },
  ],
  logbook: [
    { id: 1, category: 'Troca de turno', title: 'Passagem de plantão', description: 'Plantão entregue sem intercorrências graves. Duas encomendas aguardam retirada.', priority: 'normal', author: 'Marcos Oliveira', createdAt: hoursAgo(1) },
    { id: 2, category: 'Manutenção', title: 'Portão social em observação', description: 'Portão apresentou lentidão ao fechar. Equipe de manutenção avisada.', priority: 'atenção', author: 'Portaria', createdAt: hoursAgo(4) },
  ],
  keys: [
    { id: 1, name: 'Casa de máquinas', code: 'CH-001', location: 'Portaria', status: 'disponível', holder: '', purpose: '', checkedOutAt: null, expectedReturn: null },
    { id: 2, name: 'Salão de festas', code: 'CH-002', location: 'Portaria', status: 'retirada', holder: 'Ana Souza', purpose: 'Reserva do salão', checkedOutAt: hoursAgo(2), expectedReturn: daysFromNow(0, 23) },
    { id: 3, name: 'Quadro elétrico Bloco B', code: 'CH-003', location: 'Portaria', status: 'disponível', holder: '', purpose: '', checkedOutAt: null, expectedReturn: null },
  ],
  visitors: [
    { id: 1, name: 'Lucas Martins', document: '***.458.***-**', phone: '(11) 98888-1001', unit: 'A-101', resident: 'Ana Souza', type: 'Visitante', validFrom: hoursAgo(1), validUntil: daysFromNow(0, 22), status: 'dentro', enteredAt: hoursAgo(1), exitedAt: null, vehicle: 'ABC1D23' },
    { id: 2, name: 'Fernanda Rocha', document: '***.821.***-**', phone: '(11) 97777-2020', unit: 'B-704', resident: 'Bruno Santos', type: 'Prestador', validFrom: daysFromNow(1, 8), validUntil: daysFromNow(1, 18), status: 'autorizado', enteredAt: null, exitedAt: null, vehicle: '' },
    { id: 3, name: 'Roberto Lima', document: '***.119.***-**', phone: '(11) 96666-3010', unit: 'C-402', resident: 'Camila Alves', type: 'Visitante', validFrom: hoursAgo(26), validUntil: hoursAgo(18), status: 'finalizado', enteredAt: hoursAgo(25), exitedAt: hoursAgo(21), vehicle: '' },
  ],
  accessLogs: [
    { id: 1, person: 'Lucas Martins', unit: 'A-101', kind: 'Visitante', direction: 'entrada', method: 'qr', authorizedBy: 'Ana Souza', registeredBy: 'Marcos Oliveira', createdAt: hoursAgo(1) },
    { id: 2, person: 'Roberto Lima', unit: 'C-402', kind: 'Visitante', direction: 'saída', method: 'manual', authorizedBy: 'Camila Alves', registeredBy: 'Portaria', createdAt: hoursAgo(21) },
  ],
  vehicles: [
    { id: 1, plate: 'ABC1D23', model: 'Honda Civic', color: 'Prata', owner: 'Ana Souza', unit: 'A-101', category: 'Morador', status: 'dentro', enteredAt: hoursAgo(3), exitedAt: null, tag: 'TAG-0101', active: true },
    { id: 2, plate: 'DEF4G56', model: 'Hyundai HB20', color: 'Branco', owner: 'Bruno Santos', unit: 'B-704', category: 'Morador', status: 'fora', enteredAt: hoursAgo(28), exitedAt: hoursAgo(18), tag: 'TAG-0704', active: true },
    { id: 3, plate: 'GHI7J89', model: 'Fiat Fiorino', color: 'Branco', owner: 'Entrega Express', unit: 'Portaria', category: 'Prestador', status: 'dentro', enteredAt: hoursAgo(1), exitedAt: null, tag: '', active: true },
  ],
  vehicleLogs: [
    { id: 1, vehicleId: 1, plate: 'ABC1D23', owner: 'Ana Souza', unit: 'A-101', direction: 'entrada', method: 'tag', createdAt: hoursAgo(3), registeredBy: 'Portaria' },
    { id: 2, vehicleId: 2, plate: 'DEF4G56', owner: 'Bruno Santos', unit: 'B-704', direction: 'saída', method: 'tag', createdAt: hoursAgo(18), registeredBy: 'Portaria' },
    { id: 3, vehicleId: 3, plate: 'GHI7J89', owner: 'Entrega Express', unit: 'Portaria', direction: 'entrada', method: 'manual', createdAt: hoursAgo(1), registeredBy: 'Portaria' },
  ],
  inventory: [
    { id: 1, name: 'Lâmpada LED 12W', sku: 'EL-001', category: 'Elétrica', quantity: 18, minimum: 10, unit: 'un', location: 'Almoxarifado A', updatedAt: hoursAgo(3) },
    { id: 2, name: 'Fita isolante', sku: 'EL-002', category: 'Elétrica', quantity: 6, minimum: 8, unit: 'un', location: 'Almoxarifado A', updatedAt: hoursAgo(5) },
    { id: 3, name: 'Torneira para jardim', sku: 'HI-014', category: 'Hidráulica', quantity: 3, minimum: 2, unit: 'un', location: 'Almoxarifado B', updatedAt: hoursAgo(20) },
    { id: 4, name: 'Saco de lixo 100L', sku: 'LI-021', category: 'Limpeza', quantity: 42, minimum: 20, unit: 'pct', location: 'Depósito', updatedAt: hoursAgo(12) },
  ],
  events: [
    { id: 1, space: 'Salão de festas', title: 'Aniversário', resident: 'Ana Souza', unit: 'A-101', startsAt: daysFromNow(1, 18), endsAt: daysFromNow(1, 23), guests: 35, status: 'confirmada' },
    { id: 2, space: 'Churrasqueira', title: 'Confraternização', resident: 'Bruno Santos', unit: 'B-704', startsAt: daysFromNow(3, 12), endsAt: daysFromNow(3, 17), guests: 18, status: 'confirmada' },
  ],
  announcements: [
    { id: 1, title: 'Manutenção preventiva dos elevadores', category: 'Manutenção', audience: 'Todos', priority: 'importante', content: 'Os elevadores passarão por manutenção na quarta-feira, das 09h às 12h.', author: 'Administração COGEM', createdAt: hoursAgo(5), readBy: [1, 2, 4] },
    { id: 2, title: 'Atualização das regras da churrasqueira', category: 'Regulamento', audience: 'Moradores', priority: 'normal', content: 'Consulte o novo horário e as regras de limpeza antes de realizar sua reserva.', author: 'Síndico', createdAt: hoursAgo(30), readBy: [1, 4] },
  ],
  polls: [
    { id: 1, title: 'Novo horário da academia', question: 'Qual horário de encerramento você prefere?', options: ['22h', '23h', '24h'], status: 'ativa', endsAt: daysFromNow(5, 20), votes: { 4: '23h' }, createdAt: hoursAgo(20) },
  ],
  workOrders: [
    { id: 1, protocol: 'OS-2026-041', title: 'Revisão do portão da garagem', category: 'Portões', type: 'preventiva', priority: 'alta', location: 'Garagem principal', assignedTo: 'Carlos Mendes', description: 'Revisar sensores, trilhos e tempo de fechamento.', status: 'em andamento', openedBy: 'Administrador COGEM', dueAt: daysFromNow(1, 17), createdAt: hoursAgo(26), updatedAt: hoursAgo(2) },
    { id: 2, protocol: 'OS-2026-040', title: 'Inspeção das bombas d’água', category: 'Hidráulica', type: 'preventiva', priority: 'média', location: 'Casa de bombas', assignedTo: 'Equipe terceirizada', description: 'Checklist mensal e medição de pressão.', status: 'agendada', openedBy: 'Síndico', dueAt: daysFromNow(3, 10), createdAt: hoursAgo(48), updatedAt: hoursAgo(48) },
  ],
  documents: [
    { id: 1, name: 'Regimento interno 2026.pdf', category: 'Regulamento', visibility: 'Moradores', size: '2,4 MB', version: 3, uploadedBy: 'Administração COGEM', uploadedAt: hoursAgo(240) },
    { id: 2, name: 'Ata da assembleia ordinária.pdf', category: 'Atas', visibility: 'Moradores', size: '1,1 MB', version: 1, uploadedBy: 'Síndico', uploadedAt: hoursAgo(120) },
    { id: 3, name: 'Laudo de manutenção dos elevadores.pdf', category: 'Laudos', visibility: 'Gestão', size: '3,8 MB', version: 1, uploadedBy: 'Administração COGEM', uploadedAt: hoursAgo(72) },
  ],
  charges: [
    { id: 1, unit: 'A-101', resident: 'Ana Souza', description: 'Cota condominial - Setembro/2026', amount: 685.40, dueAt: daysFromNow(8, 23), status: 'em aberto', barcode: '00190.00009 01234.567890 12345.678901 1 99990000068540', createdAt: hoursAgo(200) },
    { id: 2, unit: 'B-704', resident: 'Bruno Santos', description: 'Cota condominial - Setembro/2026', amount: 712.90, dueAt: daysFromNow(-2, 23), status: 'vencido', barcode: '00190.00009 01234.567890 12345.678902 1 99990000071290', createdAt: hoursAgo(200) },
    { id: 3, unit: 'C-402', resident: 'Camila Alves', description: 'Cota condominial - Setembro/2026', amount: 685.40, dueAt: daysFromNow(8, 23), paidAt: hoursAgo(40), status: 'pago', barcode: '', createdAt: hoursAgo(200) },
  ],
  assemblies: [
    { id: 1, title: 'Assembleia Geral Extraordinária', description: 'Deliberação de melhorias e orçamento.', startsAt: daysFromNow(7, 19), location: 'Salão de festas + transmissão online', status: 'agendada', quorum: 38, agenda: ['Instalação de carregadores elétricos', 'Reforma da fachada', 'Novo regulamento de mudanças'], votes: {}, createdAt: hoursAgo(100) },
  ],
  pets: [
    { id: 1, name: 'Thor', species: 'Cachorro', breed: 'Golden Retriever', unit: 'A-101', guardian: 'Ana Souza', notes: 'Vacinado e dócil.', createdAt: hoursAgo(300) },
    { id: 2, name: 'Luna', species: 'Gato', breed: 'SRD', unit: 'B-704', guardian: 'Bruno Santos', notes: 'Uso exclusivo de caixa de transporte.', createdAt: hoursAgo(250) },
  ],
  moves: [
    { id: 1, unit: 'C-402', resident: 'Camila Alves', type: 'Entrada', scheduledAt: daysFromNow(2, 9), company: 'TransLar', vehicle: 'ABC9D88', status: 'agendada', createdAt: hoursAgo(20) },
  ],
  meterReadings: [
    { id: 1, unit: 'A-101', meter: 'Água', previous: 1240, current: 1268, reference: '09/2026', registeredBy: 'Administração', createdAt: hoursAgo(24) },
    { id: 2, unit: 'B-704', meter: 'Gás', previous: 430, current: 441, reference: '09/2026', registeredBy: 'Administração', createdAt: hoursAgo(24) },
  ],
  users: demoUsers,
  settings: {
    condominiumName: 'Residencial COGEM',
    document: '12.345.678/0001-90',
    address: 'São Paulo, SP',
    packageNotifications: true,
    visitorNotifications: true,
    occurrenceNotifications: true,
    emailNotifications: true,
    whatsappNotifications: true,
    facialAccess: true,
  },
  activities: [
    { id: 1, icon: 'package', title: 'Encomenda recebida', description: 'Mercado Livre para A-101', createdAt: hoursAgo(2) },
    { id: 2, icon: 'access', title: 'Entrada registrada', description: 'Lucas Martins acessou o condomínio', createdAt: hoursAgo(1) },
    { id: 3, icon: 'occurrence', title: 'Ocorrência atualizada', description: 'Vazamento marcado como em andamento', createdAt: hoursAgo(2) },
  ],
}
