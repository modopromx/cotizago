// Tarjeta "Primeros pasos" del onboarding. Muestra una barra de progreso y 5
// tareas que se auto-marcan leyendo los datos reales del workspace (¿hay logo?,
// ¿≥1 producto?, ¿≥1 cliente?, ¿≥1 cotización?, ¿≥1 enviada?). Al pulsar un paso
// navega a la pantalla con ?tour=<clave> y ahí aparece el globo guía.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Rocket, Check, ArrowRight, X, PartyPopper } from 'lucide-react'

type Conteos = { productos: number; clientes: number; cotis: number; enviadas: number }

export default function OnboardingChecklist() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Modo vista previa: con ?onboarding=1 se muestra la guía completa aunque ya
  // esté todo hecho u ocultada, y todos los pasos son cliqueables para probar
  // los globos. Sirve como "volver a ver la guía".
  const forzar = params.get('onboarding') === '1'
  const ws = profile?.workspace_id
  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [oculta, setOculta] = useState(false)

  useEffect(() => {
    if (!ws) return
    const head = (tabla: string, filtro?: (q: any) => any) => {
      let q = supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('workspace_id', ws)
      if (filtro) q = filtro(q)
      return q
    }
    Promise.all([
      head('productos'),
      head('clientes'),
      head('cotizaciones'),
      head('cotizaciones', (q: any) => q.neq('estado', 'borrador').neq('estado', 'cancelada')),
    ]).then(([p, c, co, en]) => {
      setConteos({
        productos: p.count ?? 0,
        clientes: c.count ?? 0,
        cotis: co.count ?? 0,
        enviadas: en.count ?? 0,
      })
    })
  }, [ws])

  const pasos = useMemo(() => {
    const k = conteos ?? { productos: 0, clientes: 0, cotis: 0, enviadas: 0 }
    return [
      { hecho: !!profile?.logo_url, titulo: 'Configura tu empresa', desc: 'Logo, datos y CLABE para tus cotizaciones', ruta: '/app/configuracion', tour: 'empresa' },
      { hecho: k.productos > 0, titulo: 'Crea tu primer servicio', desc: 'Con precio y unidad, listo para reutilizar', ruta: '/app/productos', tour: 'productos' },
      { hecho: k.clientes > 0, titulo: 'Agrega un cliente', desc: 'Para cotizarle en segundos', ruta: '/app/clientes', tour: 'clientes' },
      { hecho: k.cotis > 0, titulo: 'Crea tu primera cotización', desc: 'Elige cliente y conceptos del catálogo', ruta: '/app/cotizaciones/nueva', tour: 'cotizacion' },
      { hecho: k.enviadas > 0, titulo: 'Envíala a tu cliente', desc: 'Por WhatsApp, correo o enlace', ruta: '/app/cotizaciones', tour: 'enviar' },
    ]
  }, [conteos, profile?.logo_url])

  const completados = pasos.filter(p => p.hecho).length
  const total = pasos.length
  const pct = Math.round((completados / total) * 100)
  const todoListo = completados === total
  const mostrarPasos = !todoListo || forzar

  // No mostrar si el usuario la ocultó, o mientras carga el perfil.
  // En vista previa (?onboarding=1) se muestra siempre.
  if (!profile) return null
  if (!forzar && (profile.onboarding_dismissed || oculta)) return null

  const ocultar = async () => {
    setOculta(true)
    await supabase.from('profiles').update({ onboarding_dismissed: true }).eq('id', profile.id)
    refreshProfile()
  }

  const irAlPaso = (ruta: string, tour: string) => {
    const sep = ruta.includes('?') ? '&' : '?'
    navigate(`${ruta}${sep}tour=${tour}`)
  }

  return (
    <div className="card p-5 border border-primary-100 bg-gradient-to-br from-primary-50/60 to-white">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary-600 text-navy-900 flex items-center justify-center shrink-0">
            {todoListo ? <PartyPopper className="w-5 h-5" aria-hidden="true" /> : <Rocket className="w-5 h-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="font-bold text-navy-900">{todoListo && !forzar ? '¡Todo listo! 🎉' : 'Primeros pasos'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {todoListo && !forzar
                ? 'Ya configuraste lo esencial de Cotiza Go.'
                : forzar
                  ? 'Vista previa de la guía. Toca cualquier paso para ver su globo.'
                  : 'Configura tu cuenta en 5 pasos y crea tu primera cotización.'}
            </p>
          </div>
        </div>
        <button onClick={ocultar} title="Ocultar" aria-label="Ocultar primeros pasos" className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-lg shrink-0">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="flex items-center gap-3 mt-4">
        <div role="progressbar" aria-valuenow={completados} aria-valuemin={0} aria-valuemax={total} aria-label="Progreso de primeros pasos" className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-semibold text-slate-500 shrink-0">{completados}/{total}</span>
      </div>

      {/* Lista de pasos */}
      {mostrarPasos && (
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {pasos.map((p, i) => {
            // En vista previa todos son cliqueables (para probar cada globo).
            const cliqueable = forzar || !p.hecho
            return (
              <button
                key={p.titulo}
                onClick={() => cliqueable && irAlPaso(p.ruta, p.tour)}
                disabled={!cliqueable}
                className={`flex items-center gap-3 text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  !cliqueable
                    ? 'border-success-100 bg-success-50/50 cursor-default'
                    : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50/40'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  p.hecho ? 'bg-success-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {p.hecho ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-medium truncate ${p.hecho && !forzar ? 'text-slate-500 line-through' : 'text-navy-900'}`}>{p.titulo}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{p.desc}</span>
                  {p.hecho && <span className="sr-only">(completado)</span>}
                </span>
                {cliqueable && <ArrowRight className="w-4 h-4 text-primary-700 shrink-0" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
