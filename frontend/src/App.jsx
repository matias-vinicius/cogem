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

const protectedRoutes = [
  { path: '/', module: 'dashboard', element: <DashboardPage /> },
  { path: '/ocorrencias', module: 'occurrences', element: <OccurrencesPage /> },
  { path: '/encomendas', module: 'packages', element: <PackagesPage /> },
  { path: '/livro-portaria', module: 'logbook', element: <LogbookPage /> },
  { path: '/chaves', module: 'keys', element: <KeysPage /> },
  { path: '/visitantes', module: 'visitors', element: <VisitorsPage /> },
  { path: '/controle-acesso', module: 'access', element: <AccessPage /> },
  { path: '/estoque', module: 'inventory', element: <InventoryPage /> },
  { path: '/reservas', module: 'events', element: <EventsPage /> },
  { path: '/usuarios', module: 'users', element: <UsersPage /> },
  { path: '/configuracoes', module: 'settings', element: <SettingsPage /> },
  { path: '/perfil', module: 'profile', element: <ProfilePage /> },
  { path: '/ajuda', module: 'help', element: <HelpPage /> },
]

function PrivateArea() {
  return <AppShell><Routes>{protectedRoutes.map((route) => <Route key={route.path} path={route.path} element={<ProtectedRoute module={route.module}>{route.element}</ProtectedRoute>} />)}<Route path="*" element={<Navigate to="/" replace />} /></Routes></AppShell>
}

export default function App() {
  const { user } = useAuth()
  return <Routes><Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} /><Route path="/*" element={<ProtectedRoute><PrivateArea /></ProtectedRoute>} /></Routes>
}
