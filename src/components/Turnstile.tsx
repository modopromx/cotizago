// Widget de Cloudflare Turnstile (CAPTCHA invisible/gestionado). Genera un token
// que se envía a Supabase Auth (options.captchaToken) para frenar bots en el
// login y el registro. La "site key" es pública; la "secret key" vive en Supabase.
import { useEffect, useRef } from 'react'

// Clave del sitio (pública) del widget "Cotiza Go" en Cloudflare Turnstile.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAD-tI2-ESSO4LNmx'

// Carga el script una sola vez, aunque haya varios widgets.
let scriptPromise: Promise<void> | null = null
function cargarScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if ((window as any).turnstile) return resolve()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se pudo cargar Turnstile'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

interface Props {
  onVerify: (token: string) => void
  onExpire?: () => void
}

// Para forzar un widget nuevo (token nuevo) tras un intento fallido, cambia el
// prop `key` desde el componente padre: así se desmonta y se vuelve a montar.
export default function Turnstile({ onVerify, onExpire }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    let cancelado = false
    cargarScript()
      .then(() => {
        if (cancelado || !ref.current) return
        const ts = (window as any).turnstile
        if (!ts) return
        widgetId.current = ts.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onVerify(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
        })
      })
      .catch(() => { /* si falla la carga, el botón queda deshabilitado */ })
    return () => {
      cancelado = true
      const ts = (window as any).turnstile
      if (ts && widgetId.current) { try { ts.remove(widgetId.current) } catch { /* ya removido */ } }
    }
  }, [])

  return <div ref={ref} className="flex justify-center min-h-[65px]" />
}
