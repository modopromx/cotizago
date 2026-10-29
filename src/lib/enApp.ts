// ¿Se está usando dentro de la app de Android (Trusted Web Activity)?
// (29-oct-2026) Google Play exige su propio cobro para lo digital que se usa
// dentro de la app (folios y módulos) y prohíbe mandar a pagar por fuera. Cotiza Go
// no usa el cobro de Google: dentro de la app NO se ofrece comprar nada, ni con
// botón ni con enlace a la web. Se compra solo desde el navegador.
//
// La app abre https://cotizago.com.mx/app?desde=app (y Android manda como
// referrer android-app://mx.com.cotizago.app). La marca va en sessionStorage:
// dura lo que dura la pestaña de la app y no se pasa al Chrome normal.
const MARCA = 'cg_app'

export function detectarApp() {
  try {
    const desde = new URLSearchParams(window.location.search).get('desde')
    if (desde === 'app' || document.referrer.startsWith('android-app://mx.com.cotizago.app')) {
      sessionStorage.setItem(MARCA, '1')
    }
  } catch { /* sin almacenamiento: se comporta como la web */ }
}

export function enApp(): boolean {
  try { return sessionStorage.getItem(MARCA) === '1' } catch { return false }
}
