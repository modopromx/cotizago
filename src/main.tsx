import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './lib/i18n'
import './index.css'

// Monitoreo de errores en producción (Sentry). Solo se activa en el sitio
// publicado, no en desarrollo, para no ensuciar el panel con pruebas locales.
Sentry.init({
  dsn: 'https://38c017db3268125b6c53b62490cd4c66@o4511807618875392.ingest.us.sentry.io/4511807701188608',
  enabled: import.meta.env.PROD,
  environment: import.meta.env.MODE,
  // Muestra de trazas de rendimiento (bajo, para no gastar la cuota gratis).
  tracesSampleRate: 0.1,
  // No enviar datos personales del usuario en los reportes.
  sendDefaultPii: false,
})

// Tras subir una versión nueva, una pestaña abierta puede pedir un trozo de la
// versión anterior que ya no existe: se recarga una vez para tomar la nueva.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('cg_recarga_version')) return
    sessionStorage.setItem('cg_recarga_version', '1')
  } catch { /* sin almacenamiento: recargar igual */ }
  e.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
