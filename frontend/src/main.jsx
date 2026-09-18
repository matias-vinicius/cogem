import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { OccurrencesProvider } from './context/OccurrencesContext'
import { SettingsProvider } from './context/SettingsContext'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <OccurrencesProvider>
          <App />
        </OccurrencesProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
