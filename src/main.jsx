import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable font — bundled by Vite, no runtime CDN request.
import '@fontsource-variable/manrope'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
