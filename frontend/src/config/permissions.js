export const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Síndico',
  concierge: 'Portaria',
  maintenance: 'Manutenção',
  resident: 'Morador',
}

export const PERMISSIONS = {
  admin: ['dashboard', 'occurrences', 'packages', 'logbook', 'keys', 'visitors', 'vehicles', 'access', 'inventory', 'events', 'communications', 'maintenanceHub', 'documents', 'users', 'settings', 'profile', 'help'],
  manager: ['dashboard', 'occurrences', 'packages', 'logbook', 'keys', 'visitors', 'vehicles', 'access', 'inventory', 'events', 'communications', 'maintenanceHub', 'documents', 'finance', 'assemblies', 'registrations', 'users', 'settings', 'profile', 'help'],
  concierge: ['dashboard', 'occurrences', 'packages', 'logbook', 'keys', 'visitors', 'vehicles', 'access', 'events', 'communications', 'profile', 'help'],
  maintenance: ['dashboard', 'occurrences', 'logbook', 'inventory', 'maintenanceHub', 'documents', 'profile', 'help'],
  resident: ['occurrences', 'packages', 'profile', 'help'],
}

export const ROLE_HOME = {
  admin: '/',
  manager: '/',
  concierge: '/',
  maintenance: '/',
  resident: '/encomendas',
}

export function canAccess(role, module) {
  return PERMISSIONS[role]?.includes(module) ?? false
}

export function getRoleHome(role) {
  return ROLE_HOME[role] || '/login'
}
