// App de iPhone (Capacitor). Carga el sitio publicado, igual que la app de Android:
// lo que se sube a Hostinger aparece en la app sin mandar otra versión a Apple.
// ?desde=app activa el modo app (sin compras: Apple tampoco permite vender
// folios o módulos fuera de su cobro, ni mandar a pagar por fuera).
// ios-www/ solo se ve si el sitio no carga (sin internet).
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'mx.com.cotizago.app',
  appName: 'Cotiza Go',
  webDir: 'ios-www',
  server: {
    url: 'https://cotizago.com.mx/app?desde=app',
    errorPath: 'sin-conexion.html',
  },
  ios: {
    // El sitio ya respeta las zonas seguras (env(safe-area-inset-*)).
    contentInset: 'never',
    backgroundColor: '#FFFFFF',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
}

export default config
