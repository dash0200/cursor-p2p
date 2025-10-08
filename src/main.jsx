import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import WebRTCManualSignal from './components/WebRTCManualSignal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <WebRTCManualSignal />
  </StrictMode>,
)
