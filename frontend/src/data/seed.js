const now = Date.now()
const hoursAgo = (hours) => new Date(now - hours * 3600000).toISOString()
const daysFromNow = (days, hour = 12) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export const demoUsers = [
  { id: 1, name: 'Administrador COGEM', email: 'admin@cogem.com', password: '123456', role: 'admin', unit: 'Administração', active: true },
  { id: 2, name: 'Marcos Oliveira', email: 'portaria@cogem.com', password: '123456', role: 'concierge', unit: 'Portaria', active: true },
  { id: 3, name: 'Carlos Mendes', email: 'manutencao@cogem.com', password: '123456', role: 'maintenance', unit: 'Manutenção', active: true },
  { id: 4, name: 'Ana Souza', email: 'morador@cogem.com', password: '123456', role: 'resident', unit: 'Bloco A · 101', active: true },
  { id: 5, name: 'Patrícia Lima', email: 'sindico@cogem.com', password: '123456', role: 'manager', unit: 'Administração', active: true },
]

export const initialData = {
  occurrences: [
    { id: 1, title: 'Lâmpada queimada no corredor', description: 'Lâmpada do corredor do 10º andar não acende.', block: 'A', floor: 10, side: 'A', type: 'comum', status: 'em aberto', reporter: 'Ana Souza', createdAt: hoursAgo(3), updatedAt: hoursAgo(3) },
    { id: 2, title: 'Vazamento próximo ao elevador', description: 'Água acumulando ao lado do elevador social.', block: 'B', floor: 7, side: 'B', type: 'urgente', status: 'em andamento', reporter: 'Portaria', createdAt: hoursAgo(7), updatedAt: hoursAgo(2) },
    { id: 3, title: 'Interfone sem áudio', description: 'Interfone do apartamento não transmite áudio.', block: 'C', floor: 4, side: 'A', type: 'comum', status: 'concluída', reporter: 'João Lima', createdAt: hoursAgo(34), updatedAt: hoursAgo(8) },
  ],
  packages: [
    { id: 1, recipient: 'Ana Souza', unit: 'A-101', carrier: 'Mercado Livre', tracking: 'MLB-943821', description: 'Caixa média', status: 'aguardando retirada', receivedBy: 'Marcos Oliveira', receivedAt: hoursAgo(2), deliveredAt: null, deliveredTo: '' },
    { id: 2, recipient: 'Bruno Santos', unit: 'B-704', carrier: 'Correios', tracking: 'BR928430', description: 'Envelope', status: 'aguardando retirada', receivedBy: 'Marcos Oliveira', receivedAt: hoursAgo(5), deliveredAt: null, deliveredTo: '' },
    { id: 3, recipient: 'Camila Alves', unit: 'C-402', carrier: 'Amazon', tracking: 'AMZ-115920', description: 'Caixa pequena', status: 'entregue', receivedBy: 'Portaria', receivedAt: hoursAgo(27), deliveredAt: hoursAgo(21), deliveredTo: 'Camila Alves' },
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
    { id: 1, person: 'Lucas Martins', unit: 'A-101', kind: 'Visitante', direction: 'entrada', authorizedBy: 'Ana Souza', registeredBy: 'Marcos Oliveira', createdAt: hoursAgo(1) },
    { id: 2, person: 'Roberto Lima', unit: 'C-402', kind: 'Visitante', direction: 'saída', authorizedBy: 'Camila Alves', registeredBy: 'Portaria', createdAt: hoursAgo(21) },
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
  users: demoUsers,
  settings: {
    condominiumName: 'Residencial COGEM',
    document: '12.345.678/0001-90',
    address: 'São Paulo, SP',
    packageNotifications: true,
    visitorNotifications: true,
    occurrenceNotifications: true,
  },
  activities: [
    { id: 1, icon: 'package', title: 'Encomenda recebida', description: 'Mercado Livre para A-101', createdAt: hoursAgo(2) },
    { id: 2, icon: 'access', title: 'Entrada registrada', description: 'Lucas Martins acessou o condomínio', createdAt: hoursAgo(1) },
    { id: 3, icon: 'occurrence', title: 'Ocorrência atualizada', description: 'Vazamento marcado como em andamento', createdAt: hoursAgo(2) },
  ],
}
