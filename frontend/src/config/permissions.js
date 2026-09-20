export const ROLE_LABELS = {
  admin: 'Administrador',
  manager: 'Síndico',
  concierge: 'Portaria',
  maintenance: 'Manutenção',
  resident: 'Morador',
}

export const PERMISSIONS = {
  admin: ['dashboard', 'occurrences', 'packages', 'logbook', 'keys', 'visitors', 'access', 'inventory', 'events', 'users', 'settings', 'profile', 'help'],
  manager: ['dashboard', 'occurrences', 'packages', 'logbook', 'keys', 'visitors', 'access', 'inventory', 'events', 'users', 'settings', 'profile', 'help'],
  concierge: ['dashboard', 'occurrences', 'packages', 'logbook', 'keys', 'visitors', 'access', 'events', 'profile', 'help'],
  maintenance: ['dashboard', 'occurrences', 'logbook', 'inventory', 'profile', 'help'],
  resident: ['dashboard', 'occurrences', 'packages', 'visitors', 'events', 'profile', 'help'],
}

export function canAccess(role, module) {
  return PERMISSIONS[role]?.includes(module) ?? false
}
