import { createContext, useContext, useMemo, useState } from 'react'
import { initialData } from '../data/seed'
import { useAuth } from './AuthContext'

const DataContext = createContext(null)
const STORAGE_KEY = 'cogem_data_v3'

function cloneInitialData() {
  return JSON.parse(JSON.stringify(initialData))
}

function readData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
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
    commit((current) => {
      const item = { id: nextId(current.packages), status: 'aguardando retirada', receivedAt: new Date().toISOString(), deliveredAt: null, deliveredTo: '', receivedBy: user?.name || 'Portaria', ...payload }
      return withActivity({ ...current, packages: [item, ...current.packages] }, { icon: 'package', title: 'Encomenda recebida', description: `${item.carrier} para ${item.unit} · ${item.recipient}` })
    })
  }

  function deliverPackage(id, deliveredTo) {
    commit((current) => {
      const item = current.packages.find((entry) => entry.id === Number(id))
      return withActivity({ ...current, packages: current.packages.map((entry) => entry.id === Number(id) ? { ...entry, status: 'entregue', deliveredAt: new Date().toISOString(), deliveredTo } : entry) }, { icon: 'package', title: 'Encomenda entregue', description: `${item?.unit || ''} · retirada por ${deliveredTo}` })
    })
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

  function saveSettings(settings) {
    commit((current) => ({ ...current, settings }))
  }

  function resetDemo() {
    const fresh = cloneInitialData()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    setData(fresh)
  }

  const value = useMemo(() => ({
    ...data,
    createOccurrence, updateOccurrenceStatus,
    createPackage, deliverPackage,
    createLogEntry,
    createKey, checkoutKey, returnKey,
    createVisitor, registerVisitorEntry, registerVisitorExit,
    registerManualAccess,
    createInventoryItem, adjustInventory,
    createEvent, cancelEvent,
    createUser, toggleUser,
    saveSettings, resetDemo,
  }), [data, user])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  return useContext(DataContext)
}
