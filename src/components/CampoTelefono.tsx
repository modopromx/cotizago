// Campo de teléfono con selector de país.
// Guarda el número en formato internacional (solo dígitos, con código de país),
// que es lo que wa.me necesita para abrir el chat correcto.

export const PAISES = [
  { code: 'MX', dial: '52', nombre: 'México', flag: '🇲🇽' },
  { code: 'US', dial: '1', nombre: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'CO', dial: '57', nombre: 'Colombia', flag: '🇨🇴' },
  { code: 'AR', dial: '54', nombre: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', dial: '56', nombre: 'Chile', flag: '🇨🇱' },
  { code: 'PE', dial: '51', nombre: 'Perú', flag: '🇵🇪' },
  { code: 'EC', dial: '593', nombre: 'Ecuador', flag: '🇪🇨' },
  { code: 'GT', dial: '502', nombre: 'Guatemala', flag: '🇬🇹' },
  { code: 'CR', dial: '506', nombre: 'Costa Rica', flag: '🇨🇷' },
  { code: 'PA', dial: '507', nombre: 'Panamá', flag: '🇵🇦' },
  { code: 'DO', dial: '1', nombre: 'Rep. Dominicana', flag: '🇩🇴' },
  { code: 'SV', dial: '503', nombre: 'El Salvador', flag: '🇸🇻' },
  { code: 'HN', dial: '504', nombre: 'Honduras', flag: '🇭🇳' },
  { code: 'NI', dial: '505', nombre: 'Nicaragua', flag: '🇳🇮' },
  { code: 'BO', dial: '591', nombre: 'Bolivia', flag: '🇧🇴' },
  { code: 'PY', dial: '595', nombre: 'Paraguay', flag: '🇵🇾' },
  { code: 'UY', dial: '598', nombre: 'Uruguay', flag: '🇺🇾' },
  { code: 'VE', dial: '58', nombre: 'Venezuela', flag: '🇻🇪' },
  { code: 'BR', dial: '55', nombre: 'Brasil', flag: '🇧🇷' },
  { code: 'ES', dial: '34', nombre: 'España', flag: '🇪🇸' },
]

// Códigos más largos primero, para que "593" gane sobre "59"/"5".
const PORLARGO = [...PAISES].sort((a, b) => b.dial.length - a.dial.length)

/** Separa un número internacional en país + número nacional. */
export function separarTelefono(valor?: string, paisDefault = 'MX') {
  const digitos = (valor ?? '').replace(/\D/g, '')
  if (!digitos) return { dial: PAISES.find(p => p.code === paisDefault)?.dial ?? '52', nacional: '' }
  const p = PORLARGO.find(x => digitos.startsWith(x.dial))
  return p
    ? { dial: p.dial, nacional: digitos.slice(p.dial.length) }
    : { dial: PAISES.find(x => x.code === paisDefault)?.dial ?? '52', nacional: digitos }
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
  const { dial, nacional } = separarTelefono(value, paisDefault)

  const setDial = (d: string) => onChange(`${d}${nacional}`)
  const setNacional = (n: string) => onChange(`${dial}${n.replace(/\D/g, '')}`)

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <select className="input w-auto shrink-0" value={dial} onChange={e => setDial(e.target.value)}>
          {PAISES.map(p => (
            <option key={p.code} value={p.dial}>{p.flag} +{p.dial}</option>
          ))}
        </select>
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
