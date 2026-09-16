import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { OccurrencesProvider } from './context/OccurrencesContext'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <OccurrencesProvider>
        <App />
      </OccurrencesProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
