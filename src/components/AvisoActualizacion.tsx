// La PWA/Service Worker se retiró (antes causaba versiones viejas cacheadas).
// Este componente YA NO usa workbox (useRegisterSW) — en Safari iOS lanzaba
// «InvalidStateError: newestWorker is null» al no existir ya el worker.
// En su lugar, hace una limpieza directa y silenciosa: desregistra cualquier
// Service Worker viejo y borra sus cachés, para que todos vean siempre la última
// versión. Es idempotente y seguro (no hace nada si ya está limpio).
import { useEffect } from 'react'

export default function AvisoActualizacion() {
  useEffect(() => {
    ;(async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          for (const r of regs) { try { await r.unregister() } catch { /* ignorar */ } }
        }
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys()
          for (const k of keys) { try { await caches.delete(k) } catch { /* ignorar */ } }
        }
      } catch { /* silencioso: nunca debe romper la app */ }
    })()
  }, [])

  return null
}
