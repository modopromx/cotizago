// Descarga de archivos generados en el navegador (PDF de cotización, nota, CFDI).
//
// Armar el PDF tarda unos segundos (descarga el generador, el logo y el QR). Para
// entonces el navegador ya no cuenta la descarga como hecha por el clic del
// usuario y la bloquea en silencio (Chrome la trata como «descarga automática»,
// Safari en iPhone la ignora). Si el clic sigue vigente, se descarga directo; si
// no, se muestra un aviso con el botón «Descargar», cuyo clic sí vale.
import { createElement } from 'react'
import toast from 'react-hot-toast'
import type { jsPDF } from 'jspdf'

function guardar(url: string, nombre: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** true = ya se descargó; false = se mostró el botón «Descargar». */
export function descargarBlob(blob: Blob, nombre: string): boolean {
  const url = URL.createObjectURL(blob)
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)

  const clicVigente = (navigator as any).userActivation?.isActive ?? false
  if (clicVigente) { guardar(url, nombre); return true }

  toast((t) => createElement('div', { className: 'flex items-center gap-3' },
    createElement('span', { className: 'text-sm' }, 'Tu PDF está listo'),
    createElement('button', {
      className: 'px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-semibold',
      onClick: () => { guardar(url, nombre); toast.dismiss(t.id) },
    }, 'Descargar'),
  ), { id: 'pdf-listo', duration: 60_000 })
  return false
}

export function descargarPDF(doc: jsPDF, nombre: string): boolean {
  return descargarBlob(doc.output('blob'), nombre)
}
