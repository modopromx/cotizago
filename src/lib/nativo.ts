// Funciones del teléfono para la app de iPhone (Capacitor).
// (29-oct-2026) La app de iOS carga el mismo sitio; Capacitor inyecta
// window.Capacitor con el puente nativo. En el navegador y en la app de Android
// (TWA) no existe, y todo esto se queda quieto.
//
// - PDF: en el WebView de iPhone una descarga <a download> no hace nada; se
//   guarda el archivo y se abre la hoja de «Compartir» de iOS.
// - Avisos: el token de notificaciones se guarda en dispositivos_push y la
//   función enviar-push avisa cuando un cliente abre, acepta o rechaza.
import { supabase } from './supabase'

export function esNativo(): boolean {
  try { return !!(window as any).Capacitor?.isNativePlatform?.() } catch { return false }
}

function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Guarda el archivo y abre «Compartir» de iOS (WhatsApp, Mail, Archivos…). */
export async function compartirArchivo(blob: Blob, nombre: string): Promise<boolean> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const limpio = nombre.replace(/[^\w.\-]+/g, '_')
  const { uri } = await Filesystem.writeFile({
    path: limpio,
    data: await aBase64(blob),
    directory: Directory.Cache,
  })
  try {
    await Share.share({ title: nombre, files: [uri] })
  } catch (e: any) {
    // Cerrar la hoja sin elegir nada no es un error.
    if (!/cancel/i.test(String(e?.message ?? e))) throw e
  }
  return true
}

let registrado = false
const TOKEN = 'cg_push_token'

/** Pide permiso de notificaciones y guarda el token del teléfono. */
export async function registrarAvisos(userId: string) {
  if (!esNativo() || registrado) return
  registrado = true
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    let permiso = await PushNotifications.checkPermissions()
    if (permiso.receive === 'prompt' || permiso.receive === 'prompt-with-rationale') {
      permiso = await PushNotifications.requestPermissions()
    }
    if (permiso.receive !== 'granted') return

    await PushNotifications.addListener('registration', async ({ value }) => {
      try { localStorage.setItem(TOKEN, value) } catch { /* sin almacenamiento */ }
      await supabase.from('dispositivos_push').upsert(
        { user_id: userId, token: value, plataforma: 'ios', actualizado_at: new Date().toISOString() },
        { onConflict: 'token' },
      )
    })
    // Al tocar el aviso, abrir la lista de cotizaciones.
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      if (!location.pathname.startsWith('/app/cotizaciones')) location.assign('/app/cotizaciones')
    })
    await PushNotifications.register()
  } catch {
    registrado = false
  }
}

/** Antes de cerrar sesión: el teléfono deja de recibir avisos de esa cuenta. */
export async function olvidarDispositivo() {
  if (!esNativo()) return
  try {
    const token = localStorage.getItem(TOKEN)
    if (token) await supabase.from('dispositivos_push').delete().eq('token', token)
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.removeAllListeners()
  } catch { /* sin plugin o sin red: el token caduca solo */ }
  registrado = false
}
