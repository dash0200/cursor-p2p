import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import WebRTCManualSignal from './components/WebRTCManualSignal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <App /> */}
    <WebRTCManualSignal />
  </StrictMode>,
)
