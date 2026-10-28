// Ventana emergente accesible y compartida por toda la app.
// - role="dialog" + aria-modal + título enlazado (aria-labelledby).
// - Escape y clic en el fondo cierran (si `onClose` existe).
// - El foco entra a la ventana al abrir, no se escapa con Tab y vuelve al
//   botón que la abrió al cerrar.
// - Bloquea el scroll de la página mientras está abierta.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({
  titulo, onClose, children, ancho = 'max-w-lg', sinCerrar = false, className = '',
}: {
  titulo: ReactNode
  onClose?: () => void
  children: ReactNode
  ancho?: string
  /** Oculta la X y desactiva Escape/fondo (p. ej. mientras se guarda). */
  sinCerrar?: boolean
  className?: string
}) {
  const idTitulo = useId()
  const caja = useRef<HTMLDivElement>(null)
  // El listener de teclado se monta una sola vez: lee los valores vigentes por ref
  // (si no, `sinCerrar` mientras se guarda no bloquearía Escape).
  const vivo = useRef({ onClose, sinCerrar })
  vivo.current = { onClose, sinCerrar }

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const primero = caja.current?.querySelector<HTMLElement>(ENFOCABLES)
    ;(primero ?? caja.current)?.focus()

    const tecla = (e: KeyboardEvent) => {
      const { onClose: cerrar, sinCerrar: bloqueado } = vivo.current
      if (e.key === 'Escape' && cerrar && !bloqueado) { e.stopPropagation(); cerrar() }
      if (e.key !== 'Tab' || !caja.current) return
      const els = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter(el => el.offsetParent !== null)
      if (!els.length) return
      const [a, z] = [els[0], els[els.length - 1]]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
    // Solo al montar/desmontar: re-ejecutarlo robaría el foco al escribir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-navy-950/60"
      onMouseDown={e => { if (e.target === e.currentTarget && onClose && !sinCerrar) onClose() }}>
      <div ref={caja} role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}
        className={`w-full ${ancho} bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] overflow-y-auto focus:outline-none pb-[env(safe-area-inset-bottom)] ${className}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-100">
          <h2 id={idTitulo} className="text-base font-semibold text-navy-900">{titulo}</h2>
          {onClose && !sinCerrar && (
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="w-9 h-9 -mr-2 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-navy-900">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
