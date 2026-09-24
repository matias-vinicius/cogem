import { createContext, useContext, useMemo, useState } from 'react'
import { initialData } from '../data/seed'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)
const STORAGE_KEY = 'cogem_data_v1'
const LEGACY_STORAGE_KEYS = ['cogem_data_v6']

function cloneInitialData() {
  return JSON.parse(JSON.stringify(initialData))
}

function readData() {
  try {
    const current = localStorage.getItem(STORAGE_KEY)
    const legacy = LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    const source = current || legacy
    if (!current && legacy) localStorage.setItem(STORAGE_KEY, legacy)
    const stored = JSON.parse(source || 'null')
    return stored ? { ...cloneInitialData(), ...stored } : cloneInitialData()
  } catch {
    return cloneInitialData()
  }
}

function nextId(list) {
  return list.reduce((largest, item) => Math.max(largest, Number(item.id) || 0), 0) + 1
}

export function DataProvider({ children }) {
  const [data, setData] = useState(readData)
  const { user } = useAuth()

  function commit(recipe) {
    setData((current) => {
      const next = recipe(current)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function withActivity(current, activity) {
    return {
      ...current,
      activities: [{ id: Date.now(), createdAt: new Date().toISOString(), ...activity }, ...current.activities].slice(0, 100),
    }
  }

  function createOccurrence(payload) {
    let created
    commit((current) => {
      created = { id: nextId(current.occurrences), status: 'em aberto', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), reporter: user?.name || 'Usuário', ...payload }
      return withActivity({ ...current, occurrences: [created, ...current.occurrences] }, { icon: 'occurrence', title: 'Nova ocorrência cadastrada', description: `${created.title} · ${created.block}-${created.floor}` })
    })
    return created
  }

  function updateOccurrenceStatus(id, status) {
    commit((current) => {
      const occurrence = current.occurrences.find((item) => item.id === Number(id))
      return withActivity({ ...current, occurrences: current.occurrences.map((item) => item.id === Number(id) ? { ...item, status, updatedAt: new Date().toISOString() } : item) }, { icon: 'occurrence', title: 'Status de ocorrência alterado', description: `${occurrence?.title || `#${id}`} → ${status}` })
    })
  }

  function createPackage(payload) {
    const token = `COGEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    const protocol = `${new Date().getFullYear()}${String(Date.now()).slice(-6)}`
    const createdAt = new Date().toISOString()
    const item = {
      id: Date.now(),
      protocol,
      status: 'aguardando retirada',
      receivedAt: createdAt,
      deliveredAt: null,
      deliveredTo: '',
      deliveredBy: '',
      deliveryMethod: null,
      pickupToken: token,
      notificationStatus: {
        whatsapp: payload.notifyWhatsapp ? 'simulado' : 'desativado',
        email: payload.notifyEmail ? 'simulado' : 'desativado',
      },
      receivedBy: user?.name || 'Portaria',
      notificationLog: [
        ...(payload.notifyWhatsapp ? [{ id: `${Date.now()}-wa`, channel: 'WhatsApp', status: 'preparado', createdAt }] : []),
        ...(payload.notifyEmail ? [{ id: `${Date.now()}-mail`, channel: 'E-mail', status: 'preparado', createdAt }] : []),
      ],
      comments: [],
      ...payload,
    }
    commit((current) => {
      return withActivity({ ...current, packages: [item, ...current.packages] }, { icon: 'package', title: 'Encomenda recebida', description: `${item.carrier} para ${item.unit} · ${item.recipient}` })
    })
    return item
  }

  function deliverPackage(id, deliveredTo, deliveryMethod = 'manual') {
    commit((current) => {
      const item = current.packages.find((entry) => entry.id === Number(id))
      return withActivity({ ...current, packages: current.packages.map((entry) => entry.id === Number(id) ? { ...entry, status: 'entregue', deliveredAt: new Date().toISOString(), deliveredTo, deliveredBy: user?.name || 'Portaria', deliveryMethod } : entry) }, { icon: 'package', title: 'Encomenda entregue', description: `${item?.unit || ''} · retirada por ${deliveredTo} via ${deliveryMethod}` })
    })
  }

  function resendPackageNotification(id, channel) {
    commit((current) => {
      const createdAt = new Date().toISOString()
      return {
        ...current,
        packages: current.packages.map((item) => item.id === Number(id) ? {
          ...item,
          notificationStatus: { ...item.notificationStatus, [channel]: 'simulado' },
          notificationLog: [{ id: `${Date.now()}-${channel}`, channel: channel === 'whatsapp' ? 'WhatsApp' : 'E-mail', status: 'reenviado', createdAt, sentBy: user?.name || 'Portaria' }, ...(item.notificationLog || [])],
          lastNotificationAt: createdAt,
        } : item),
      }
    })
  }

  function notifyPackages(ids) {
    const normalized = ids.map(Number)
    commit((current) => {
      const createdAt = new Date().toISOString()
      return withActivity({
        ...current,
        packages: current.packages.map((item) => normalized.includes(Number(item.id)) ? {
          ...item,
          notificationStatus: { whatsapp: 'simulado', email: 'simulado' },
          notificationLog: [{ id: `${Date.now()}-${item.id}`, channel: 'WhatsApp + E-mail', status: 'reenviado em lote', createdAt, sentBy: user?.name || 'Portaria' }, ...(item.notificationLog || [])],
          lastNotificationAt: createdAt,
        } : item),
      }, { icon: 'package', title: 'Avisos de encomendas enviados', description: `${normalized.length} unidade(s) notificadas pela portaria` })
    })
  }

  function addPackageComment(id, text) {
    if (!text?.trim()) return
    commit((current) => ({
      ...current,
      packages: current.packages.map((item) => item.id === Number(id) ? {
        ...item,
        comments: [{ id: Date.now(), text: text.trim(), author: user?.name || 'Portaria', createdAt: new Date().toISOString() }, ...(item.comments || [])],
      } : item),
    }))
  }

  function createLogEntry(payload) {
    commit((current) => {
      const item = { id: nextId(current.logbook), author: user?.name || 'Usuário', createdAt: new Date().toISOString(), ...payload }
      return withActivity({ ...current, logbook: [item, ...current.logbook] }, { icon: 'log', title: 'Registro adicionado ao livro', description: item.title })
    })
  }

  function createKey(payload) {
    commit((current) => ({ ...current, keys: [{ id: nextId(current.keys), status: 'disponível', holder: '', purpose: '', checkedOutAt: null, expectedReturn: null, ...payload }, ...current.keys] }))
  }

  function checkoutKey(id, payload) {
    commit((current) => {
      const key = current.keys.find((item) => item.id === Number(id))
      return withActivity({ ...current, keys: current.keys.map((item) => item.id === Number(id) ? { ...item, status: 'retirada', checkedOutAt: new Date().toISOString(), ...payload } : item) }, { icon: 'key', title: 'Chave retirada', description: `${key?.name || ''} · ${payload.holder}` })
    })
  }

  function returnKey(id) {
    commit((current) => {
      const key = current.keys.find((item) => item.id === Number(id))
      return withActivity({ ...current, keys: current.keys.map((item) => item.id === Number(id) ? { ...item, status: 'disponível', holder: '', purpose: '', checkedOutAt: null, expectedReturn: null } : item) }, { icon: 'key', title: 'Chave devolvida', description: key?.name || `Chave #${id}` })
    })
  }

  function createVisitor(payload) {
    commit((current) => {
      const visitor = { id: nextId(current.visitors), status: 'autorizado', enteredAt: null, exitedAt: null, ...payload }
      return withActivity({ ...current, visitors: [visitor, ...current.visitors] }, { icon: 'visitor', title: 'Visitante autorizado', description: `${visitor.name} · unidade ${visitor.unit}` })
    })
  }

  function registerVisitorEntry(id) {
    commit((current) => {
      const visitor = current.visitors.find((item) => item.id === Number(id))
      const timestamp = new Date().toISOString()
      const access = { id: nextId(current.accessLogs), person: visitor.name, unit: visitor.unit, kind: visitor.type, direction: 'entrada', authorizedBy: visitor.resident, registeredBy: user?.name || 'Portaria', createdAt: timestamp }
      return withActivity({ ...current, visitors: current.visitors.map((item) => item.id === Number(id) ? { ...item, status: 'dentro', enteredAt: timestamp, exitedAt: null } : item), accessLogs: [access, ...current.accessLogs] }, { icon: 'access', title: 'Entrada registrada', description: `${visitor.name} · ${visitor.unit}` })
    })
  }

  function registerVisitorExit(id) {
    commit((current) => {
      const visitor = current.visitors.find((item) => item.id === Number(id))
      const timestamp = new Date().toISOString()
      const access = { id: nextId(current.accessLogs), person: visitor.name, unit: visitor.unit, kind: visitor.type, direction: 'saída', authorizedBy: visitor.resident, registeredBy: user?.name || 'Portaria', createdAt: timestamp }
      return withActivity({ ...current, visitors: current.visitors.map((item) => item.id === Number(id) ? { ...item, status: 'finalizado', exitedAt: timestamp } : item), accessLogs: [access, ...current.accessLogs] }, { icon: 'access', title: 'Saída registrada', description: `${visitor.name} · ${visitor.unit}` })
    })
  }

  function registerManualAccess(payload) {
    commit((current) => {
      const access = { id: nextId(current.accessLogs), registeredBy: user?.name || 'Portaria', createdAt: new Date().toISOString(), ...payload }
      return withActivity({ ...current, accessLogs: [access, ...current.accessLogs] }, { icon: 'access', title: `${payload.direction === 'entrada' ? 'Entrada' : 'Saída'} registrada`, description: `${payload.person} · ${payload.unit}` })
    })
  }

  function createVehicle(payload) {
    commit((current) => ({
      ...current,
      vehicles: [{ id: nextId(current.vehicles), status: 'fora', enteredAt: null, exitedAt: null, active: true, ...payload, plate: payload.plate.toUpperCase() }, ...current.vehicles],
    }))
  }

  function registerVehicleMovement(id, direction, method = 'manual') {
    commit((current) => {
      const vehicle = current.vehicles.find((item) => item.id === Number(id))
      const timestamp = new Date().toISOString()
      const log = { id: nextId(current.vehicleLogs), vehicleId: vehicle.id, plate: vehicle.plate, owner: vehicle.owner, unit: vehicle.unit, direction, method, createdAt: timestamp, registeredBy: user?.name || 'Portaria' }
      return withActivity({
        ...current,
        vehicles: current.vehicles.map((item) => item.id === Number(id) ? { ...item, status: direction === 'entrada' ? 'dentro' : 'fora', enteredAt: direction === 'entrada' ? timestamp : item.enteredAt, exitedAt: direction === 'saída' ? timestamp : null } : item),
        vehicleLogs: [log, ...current.vehicleLogs],
      }, { icon: 'vehicle', title: `Veículo registrou ${direction}`, description: `${vehicle.plate} · ${vehicle.owner}` })
    })
  }

  function createInventoryItem(payload) {
    commit((current) => ({ ...current, inventory: [{ id: nextId(current.inventory), updatedAt: new Date().toISOString(), ...payload, quantity: Number(payload.quantity), minimum: Number(payload.minimum) }, ...current.inventory] }))
  }

  function adjustInventory(id, delta, reason) {
    commit((current) => {
      const item = current.inventory.find((entry) => entry.id === Number(id))
      const updatedQuantity = Math.max(0, Number(item.quantity) + Number(delta))
      return withActivity({ ...current, inventory: current.inventory.map((entry) => entry.id === Number(id) ? { ...entry, quantity: updatedQuantity, updatedAt: new Date().toISOString() } : entry) }, { icon: 'inventory', title: 'Estoque movimentado', description: `${item.name}: ${delta > 0 ? '+' : ''}${delta} ${item.unit} · ${reason}` })
    })
  }

  function createEvent(payload) {
    commit((current) => {
      const event = { id: nextId(current.events), status: 'confirmada', ...payload, guests: Number(payload.guests) }
      return withActivity({ ...current, events: [event, ...current.events] }, { icon: 'event', title: 'Reserva confirmada', description: `${event.space} · ${event.unit}` })
    })
  }

  function cancelEvent(id) {
    commit((current) => ({ ...current, events: current.events.map((item) => item.id === Number(id) ? { ...item, status: 'cancelada' } : item) }))
  }

  function createUser(payload) {
    commit((current) => ({ ...current, users: [...current.users, { id: nextId(current.users), active: true, ...payload }] }))
  }

  function toggleUser(id) {
    commit((current) => ({ ...current, users: current.users.map((item) => item.id === Number(id) ? { ...item, active: !item.active } : item) }))
  }

  function updateUserFace(id, facePhoto) {
    commit((current) => ({ ...current, users: current.users.map((item) => item.id === Number(id) ? { ...item, facePhoto, faceStatus: 'cadastrada', faceRegisteredAt: new Date().toISOString() } : item) }))
  }

  function saveSettings(settings) {
    commit((current) => ({ ...current, settings }))
  }

  function createAnnouncement(payload) {
    commit((current) => {
      const item = { id: nextId(current.announcements), author: user?.name || 'Administração', createdAt: new Date().toISOString(), readBy: [], ...payload }
      return withActivity({ ...current, announcements: [item, ...current.announcements] }, { icon: 'announcement', title: 'Novo comunicado publicado', description: item.title })
    })
  }

  function createPoll(payload) {
    commit((current) => ({
      ...current,
      polls: [{ id: nextId(current.polls), status: 'ativa', votes: {}, createdAt: new Date().toISOString(), ...payload, options: payload.options.filter(Boolean) }, ...current.polls],
    }))
  }

  function votePoll(id, option) {
    commit((current) => ({ ...current, polls: current.polls.map((item) => item.id === Number(id) ? { ...item, votes: { ...item.votes, [user?.id || 'demo']: option } } : item) }))
  }

  function createWorkOrder(payload) {
    commit((current) => {
      const item = { id: nextId(current.workOrders), protocol: `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, status: 'aberta', openedBy: user?.name || 'Usuário', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...payload }
      return withActivity({ ...current, workOrders: [item, ...current.workOrders] }, { icon: 'maintenance', title: 'Ordem de serviço aberta', description: `${item.protocol} · ${item.title}` })
    })
  }

  function updateWorkOrderStatus(id, status) {
    commit((current) => ({ ...current, workOrders: current.workOrders.map((item) => item.id === Number(id) ? { ...item, status, updatedAt: new Date().toISOString() } : item) }))
  }

  function createDocument(payload) {
    commit((current) => ({ ...current, documents: [{ id: nextId(current.documents), version: 1, uploadedBy: user?.name || 'Administração', uploadedAt: new Date().toISOString(), ...payload }, ...current.documents] }))
  }

  function createCharge(payload) {
    commit((current) => ({ ...current, charges: [{ id: nextId(current.charges), status: 'em aberto', createdAt: new Date().toISOString(), ...payload, amount: Number(payload.amount) }, ...current.charges] }))
  }

  function markChargePaid(id) {
    commit((current) => ({ ...current, charges: current.charges.map((item) => item.id === Number(id) ? { ...item, status: 'pago', paidAt: new Date().toISOString() } : item) }))
  }

  function createAssembly(payload) {
    commit((current) => ({ ...current, assemblies: [{ id: nextId(current.assemblies), status: 'agendada', quorum: 0, agenda: payload.agenda.filter(Boolean), votes: {}, createdAt: new Date().toISOString(), ...payload }, ...current.assemblies] }))
  }

  function voteAssembly(id, agendaIndex, choice) {
    const key = `${user?.id || 'demo'}-${agendaIndex}`
    commit((current) => ({ ...current, assemblies: current.assemblies.map((item) => item.id === Number(id) ? { ...item, votes: { ...item.votes, [key]: choice } } : item) }))
  }

  function createPet(payload) {
    commit((current) => ({ ...current, pets: [{ id: nextId(current.pets), createdAt: new Date().toISOString(), ...payload }, ...current.pets] }))
  }

  function createMove(payload) {
    commit((current) => ({ ...current, moves: [{ id: nextId(current.moves), status: 'agendada', createdAt: new Date().toISOString(), ...payload }, ...current.moves] }))
  }

  function recordMeterReading(payload) {
    commit((current) => ({ ...current, meterReadings: [{ id: nextId(current.meterReadings), registeredBy: user?.name || 'Administração', createdAt: new Date().toISOString(), ...payload, current: Number(payload.current), previous: Number(payload.previous) }, ...current.meterReadings] }))
  }

  function resetDemo() {
    const fresh = cloneInitialData()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    setData(fresh)
  }

  const value = useMemo(() => ({
    ...data,
    createOccurrence, updateOccurrenceStatus,
    createPackage, deliverPackage, resendPackageNotification, notifyPackages, addPackageComment,
    createLogEntry,
    createKey, checkoutKey, returnKey,
    createVisitor, registerVisitorEntry, registerVisitorExit,
    registerManualAccess,
    createVehicle, registerVehicleMovement,
    createInventoryItem, adjustInventory,
    createEvent, cancelEvent,
    createUser, toggleUser, updateUserFace,
    createAnnouncement, createPoll, votePoll,
    createWorkOrder, updateWorkOrderStatus,
    createDocument,
    createCharge, markChargePaid,
    createAssembly, voteAssembly,
    createPet, createMove, recordMeterReading,
    saveSettings, resetDemo,
  }), [data, user])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
