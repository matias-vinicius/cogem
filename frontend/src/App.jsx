import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import OccurrencesPage from './pages/OccurrencesPage'
import NewOccurrencePage from './pages/NewOccurrencePage'
import OccurrenceDetailsPage from './pages/OccurrenceDetailsPage'
import ChangeStatusPage from './pages/ChangeStatusPage'
import SettingsPage from './pages/SettingsPage'
import ProfileSettingsPage from './pages/ProfileSettingsPage'
import NotificationsSettingsPage from './pages/NotificationsSettingsPage'
import ActivityLogPage from './pages/ActivityLogPage'
import StatusRulesPage from './pages/StatusRulesPage'
import HelpPage from './pages/HelpPage'
import AboutPage from './pages/AboutPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ocorrencias" element={<OccurrencesPage />} />
        <Route path="/ocorrencias/nova" element={<NewOccurrencePage />} />
        <Route path="/ocorrencias/:id" element={<OccurrenceDetailsPage />} />
        <Route path="/ocorrencias/:id/status" element={<ChangeStatusPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="/configuracoes/perfil" element={<ProfileSettingsPage />} />
        <Route path="/configuracoes/notificacoes" element={<NotificationsSettingsPage />} />
        <Route path="/configuracoes/registros" element={<ActivityLogPage />} />
        <Route path="/configuracoes/regras" element={<StatusRulesPage />} />
        <Route path="/configuracoes/ajuda" element={<HelpPage />} />
        <Route path="/configuracoes/sobre" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
