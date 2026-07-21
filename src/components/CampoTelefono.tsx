// Campo de teléfono con selector de país.
// Guarda el número en formato internacional (solo dígitos, con código de país),
// que es lo que wa.me necesita para abrir el chat correcto.
//
// Nota: NO usamos emojis de bandera (🇲🇽). Windows no incluye esos glifos y los
// pinta como dos letras ("MX"), que es justo lo que se veía mal. Usamos SVG.
import { useEffect, useRef, useState } from 'react'
import * as Banderas from 'country-flag-icons/react/3x2'
import { ChevronDown, Search } from 'lucide-react'

export const PAISES = [
  { code: 'MX', dial: '52', nombre: 'México' },
  { code: 'US', dial: '1', nombre: 'Estados Unidos' },
  { code: 'CO', dial: '57', nombre: 'Colombia' },
  { code: 'AR', dial: '54', nombre: 'Argentina' },
  { code: 'CL', dial: '56', nombre: 'Chile' },
  { code: 'PE', dial: '51', nombre: 'Perú' },
  { code: 'EC', dial: '593', nombre: 'Ecuador' },
  { code: 'GT', dial: '502', nombre: 'Guatemala' },
  { code: 'CR', dial: '506', nombre: 'Costa Rica' },
  { code: 'PA', dial: '507', nombre: 'Panamá' },
  { code: 'DO', dial: '1', nombre: 'Rep. Dominicana' },
  { code: 'SV', dial: '503', nombre: 'El Salvador' },
  { code: 'HN', dial: '504', nombre: 'Honduras' },
  { code: 'NI', dial: '505', nombre: 'Nicaragua' },
  { code: 'BO', dial: '591', nombre: 'Bolivia' },
  { code: 'PY', dial: '595', nombre: 'Paraguay' },
  { code: 'UY', dial: '598', nombre: 'Uruguay' },
  { code: 'VE', dial: '58', nombre: 'Venezuela' },
  { code: 'BR', dial: '55', nombre: 'Brasil' },
  { code: 'ES', dial: '34', nombre: 'España' },
]

// Códigos más largos primero, para que "593" gane sobre "59"/"5".
const PORLARGO = [...PAISES].sort((a, b) => b.dial.length - a.dial.length)

/** Bandera SVG de un país (24x16). */
export function Bandera({ code, className = '' }: { code: string; className?: string }) {
  const F = (Banderas as Record<string, any>)[code]
  if (!F) return <span className={`inline-block w-5 h-3.5 rounded-sm bg-slate-200 ${className}`} />
  return <F className={`inline-block w-5 h-3.5 rounded-sm object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${className}`} />
}

/** Separa un número internacional en país + número nacional. */
export function separarTelefono(valor?: string, paisDefault = 'MX') {
  const digitos = (valor ?? '').replace(/\D/g, '')
  const def = PAISES.find(p => p.code === paisDefault) ?? PAISES[0]
  if (!digitos) return { dial: def.dial, code: def.code, nacional: '' }
  const p = PORLARGO.find(x => digitos.startsWith(x.dial))
  return p
    ? { dial: p.dial, code: p.code, nacional: digitos.slice(p.dial.length) }
    : { dial: def.dial, code: def.code, nacional: digitos }
}

/** ¿Es utilizable para WhatsApp? (país + al menos 8 dígitos nacionales) */
export function telefonoValido(valor?: string) {
  const { dial, nacional } = separarTelefono(valor)
  return !!dial && nacional.length >= 8
}

interface Props {
  value?: string
  onChange: (internacional: string) => void
  label?: string
  ayuda?: string
  paisDefault?: string
}

export default function CampoTelefono({ value, onChange, label = 'Teléfono', ayuda, paisDefault = 'MX' }: Props) {
  const { dial, code, nacional } = separarTelefono(value, paisDefault)
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const elegir = (d: string) => { onChange(`${d}${nacional}`); setAbierto(false); setBusca('') }
  const setNacional = (n: string) => onChange(`${dial}${n.replace(/\D/g, '')}`)

  const lista = PAISES.filter(p =>
    !busca || p.nombre.toLowerCase().includes(busca.toLowerCase()) || p.dial.includes(busca.replace(/\D/g, ''))
  )

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <div className="relative shrink-0" ref={caja}>
          <button type="button" onClick={() => setAbierto(o => !o)}
            className="input w-auto flex items-center gap-2 pr-2" aria-haspopup="listbox" aria-expanded={abierto}>
            <Bandera code={code} />
            <span className="font-medium">+{dial}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
          </button>

          {abierto && (
            <div className="absolute z-50 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="relative p-2 border-b border-slate-100">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar país..."
                  className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:border-primary-400" />
              </div>
              <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
                {lista.map(p => (
                  <li key={p.code}>
                    <button type="button" onClick={() => elegir(p.dial)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 ${p.code === code ? 'bg-primary-50/60 font-medium' : ''}`}>
                      <Bandera code={p.code} />
                      <span className="flex-1 text-navy-900">{p.nombre}</span>
                      <span className="text-slate-400 tabular-nums">+{p.dial}</span>
                    </button>
                  </li>
                ))}
                {lista.length === 0 && <li className="px-3 py-4 text-sm text-slate-400 text-center">Sin resultados</li>}
              </ul>
            </div>
          )}
        </div>

        <input className="input flex-1" inputMode="numeric" placeholder="55 1234 5678"
          value={nacional} onChange={e => setNacional(e.target.value)} />
      </div>
      <p className="text-[11px] text-slate-400 mt-1">
        {ayuda ?? 'Sin el +, sin espacios. Se guarda como '}
        {!ayuda && <code className="font-mono">+{dial}{nacional || '…'}</code>}
      </p>
    </div>
  )
}
