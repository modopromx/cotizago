// Selector de idioma con banderas. Cambia el idioma de toda la app al instante
// (i18next) y lo recuerda en localStorage.
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BANDERAS } from '../lib/banderas'
import { IDIOMAS } from '../lib/i18n'
import { ChevronDown, Globe } from 'lucide-react'

function Bandera({ pais }: { pais: string }) {
  const F = BANDERAS[pais]
  // Decorativa: el nombre del idioma ya va en texto o en el aria-label.
  if (!F) return <Globe className="w-4 h-4" aria-hidden="true" />
  return <F aria-hidden="true" className="w-5 h-[14px] rounded-sm object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" />
}

// variant "claro" para fondos claros (header), "oscuro" para el navy (landing hero, etc.)
export default function SelectorIdioma({ variant = 'claro' }: { variant?: 'claro' | 'oscuro' }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const idLista = useId()

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [open])

  const actual = IDIOMAS.find(l => i18n.language?.startsWith(l.code)) ?? IDIOMAS[0]
  const elegir = (code: string) => { i18n.changeLanguage(code); setOpen(false) }

  const botonClase = variant === 'oscuro'
    ? 'text-white/90 hover:bg-white/10'
    : 'text-navy-700 hover:bg-slate-100'

  return (
    <div className="relative" ref={ref}>
      {/* Lista simple de botones (sin role="menu", que exigiría navegar con flechas) */}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        aria-controls={open ? idLista : undefined} aria-label={`Idioma: ${actual.label}`}
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${botonClase}`}>
        <Bandera pais={actual.pais} />
        <span className="hidden sm:inline" aria-hidden="true">{actual.code.toUpperCase()}</span>
        <ChevronDown aria-hidden="true" className={`w-3.5 h-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={idLista} className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[70] py-1">
          {IDIOMAS.map(l => (
            <button key={l.code} type="button" onClick={() => elegir(l.code)} lang={l.code}
              aria-current={l.code === actual.code ? 'true' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 ${l.code === actual.code ? 'bg-primary-50/60 font-medium' : ''}`}>
              <Bandera pais={l.pais} />
              <span className="flex-1 text-navy-900">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
