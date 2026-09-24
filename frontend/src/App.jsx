import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import AccessPage from './pages/AccessPage'
import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import InventoryPage from './pages/InventoryPage'
import KeysPage from './pages/KeysPage'
import LogbookPage from './pages/LogbookPage'
import LoginPage from './pages/LoginPage'
import HelpPage from './pages/HelpPage'
import OccurrencesPage from './pages/OccurrencesPage'
import PackagesPage from './pages/PackagesPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import VisitorsPage from './pages/VisitorsPage'
import VehiclesPage from './pages/VehiclesPage'
import CommunicationsPage from './pages/CommunicationsPage'
import MaintenancePage from './pages/MaintenancePage'
import DocumentsPage from './pages/DocumentsPage'
import FinancePage from './pages/FinancePage'
import AssembliesPage from './pages/AssembliesPage'
import RegistrationsPage from './pages/RegistrationsPage'
import { getRoleHome } from './config/permissions'

const protectedRoutes = [
  { path: '/', module: 'dashboard', element: <DashboardPage /> },
  { path: '/ocorrencias', module: 'occurrences', element: <OccurrencesPage /> },
  { path: '/encomendas', module: 'packages', element: <PackagesPage /> },
  { path: '/livro-portaria', module: 'logbook', element: <LogbookPage /> },
  { path: '/chaves', module: 'keys', element: <KeysPage /> },
  { path: '/visitantes', module: 'visitors', element: <VisitorsPage /> },
  { path: '/veiculos', module: 'vehicles', element: <VehiclesPage /> },
  { path: '/controle-acesso', module: 'access', element: <AccessPage /> },
  { path: '/estoque', module: 'inventory', element: <InventoryPage /> },
  { path: '/reservas', module: 'events', element: <EventsPage /> },
  { path: '/comunicacao', module: 'communications', element: <CommunicationsPage /> },
  { path: '/manutencao', module: 'maintenanceHub', element: <MaintenancePage /> },
  { path: '/documentos', module: 'documents', element: <DocumentsPage /> },
  { path: '/financeiro', module: 'finance', element: <FinancePage /> },
  { path: '/assembleias', module: 'assemblies', element: <AssembliesPage /> },
  { path: '/cadastros', module: 'registrations', element: <RegistrationsPage /> },
  { path: '/usuarios', module: 'users', element: <UsersPage /> },
  { path: '/configuracoes', module: 'settings', element: <SettingsPage /> },
  { path: '/perfil', module: 'profile', element: <ProfilePage /> },
  { path: '/ajuda', module: 'help', element: <HelpPage /> },
]

function PrivateArea() {
  const { user } = useAuth()
  const home = getRoleHome(user.role)
  return <AppShell><Routes>{protectedRoutes.map((route) => <Route key={route.path} path={route.path} element={route.path === '/' && user.role === 'resident' ? <Navigate to="/encomendas" replace /> : <ProtectedRoute module={route.module}>{route.element}</ProtectedRoute>} />)}<Route path="*" element={<Navigate to={home} replace />} /></Routes></AppShell>
}

export default function App() {
  const { user } = useAuth()
  return <Routes><Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} /><Route path="/*" element={<ProtectedRoute><PrivateArea /></ProtectedRoute>} /></Routes>
}
