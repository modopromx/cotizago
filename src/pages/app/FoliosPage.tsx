import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDate } from '../../lib/utils'
import { descargarNotaRemision } from '../../lib/cotizacionPdf'
import { cargarConfigStripe, instanciaStripe } from '../../lib/stripe'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import type { Stripe } from '@stripe/stripe-js'
import toast from 'react-hot-toast'
import { Coins, Check, FileText, X } from 'lucide-react'

const PAQUETES_FALLBACK = [
  { id: '1', nombre: 'Emprende', folios: 25, precio: 199, moneda: 'MXN', popular: false, orden: 1 },
  { id: '2', nombre: 'Negocio', folios: 100, precio: 499, moneda: 'MXN', popular: true, orden: 2 },
  { id: '3', nombre: 'Pro', folios: 300, precio: 999, moneda: 'MXN', popular: false, orden: 3 },
]

export default function FoliosPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [params] = useSearchParams()
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkout, setCheckout] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeCfg, setStripeCfg] = useState<{ pk: string; habilitado: boolean }>({ pk: '', habilitado: false })
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)

  // Facturación: en México es factura fiscal (CFDI); fuera de México, nota de remisión.
  const esMexico = (empresa?.pais ?? 'MX') === 'MX'
  const docFiscal = esMexico ? 'factura' : 'nota de remisión'

  useEffect(() => {
    const pago = params.get('pago')
    if (pago === 'procesando') {
      // El webhook acredita en segundo plano; refrescamos el saldo un par de veces.
      toast.success('¡Pago recibido! Acreditando tus folios...')
      refreshProfile()
      setTimeout(refreshProfile, 2500)
      setTimeout(() => { refreshProfile(); loadHistorial() }, 6000)
    } else if (pago === 'cancelado') toast.error('Pago cancelado.')
  }, [])

  const loadHistorial = () => {
    if (!user) return
    supabase.from('pagos').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setHistorial(data ?? []); setLoading(false) })
  }

  useEffect(() => { cargarConfigStripe().then(setStripeCfg) }, [])

  useEffect(() => {
    supabase.from('paquetes_folios').select('*').eq('activo', true).order('orden')
      .then(({ data }) => setPaquetes(data && data.length ? data : PAQUETES_FALLBACK))
    if (profile?.workspace_id) {
      supabase.from('empresas').select('pais,rfc,razon_social,nombre_comercial').eq('workspace_id', profile.workspace_id).maybeSingle()
        .then(({ data }) => setEmpresa(data))
    }
    loadHistorial()
  }, [user, profile?.workspace_id])

  const handleCompra = async (p: any) => {
    if (!user) return
    if (!stripeCfg.habilitado || !stripeCfg.pk) {
      toast('Pagos en línea aún no activados. Escríbenos para tu link de pago.', { icon: '💬', duration: 6000 })
      return
    }
    setCheckout(p.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sesión expirada.'); return }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ folios: p.folios, paquete_nombre: p.nombre, precio: p.precio }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.clientSecret) {
        setStripePromise(instanciaStripe(stripeCfg.pk))
        setClientSecret(data.clientSecret)
      }
      else toast.error(data.error ?? 'No se pudo iniciar el pago')
    } catch {
      toast.error('Error al conectar con el sistema de pagos')
    } finally { setCheckout(null) }
  }

  const solicitarFactura = async (pago: any) => {
    if (!user) return
    if (!empresa?.rfc) {
      toast.error(`Agrega tu RFC / ID fiscal en "Mi empresa" para solicitar tu ${docFiscal}.`)
      return
    }

    // Nota de remisión (fuera de México): NO es fiscal, se genera al instante.
    if (!esMexico) {
      const t = toast.loading('Generando nota de remisión...')
      try {
        await descargarNotaRemision({
          folio: `NR-${(pago.id as string).slice(0, 8).toUpperCase()}`,
          fecha: pago.created_at,
          receptor: { nombre: empresa?.razon_social ?? empresa?.nombre_comercial, rfc: empresa?.rfc, pais: empresa?.pais },
          concepto: `${pago.paquete_nombre ?? 'Recarga de folios'} · ${pago.folios_cantidad ?? 0} folios`,
          monto: pago.monto, moneda: pago.moneda ?? 'MXN',
        })
        await supabase.from('facturas_solicitudes').insert({
          user_id: user.id, pago_id: pago.id, monto: pago.monto, estado: 'emitida',
          tipo: 'nota_remision', pais: empresa?.pais ?? null,
          rfc: empresa?.rfc ?? null, razon_social: empresa?.razon_social ?? empresa?.nombre_comercial ?? null,
        })
        toast.success('Nota de remisión generada y descargada', { id: t })
        loadHistorial()
      } catch { toast.error('No se pudo generar la nota de remisión', { id: t }) }
      return
    }

    // Factura fiscal (México): la emite administración con CFDI (PDF + XML).
    const { error } = await supabase.from('facturas_solicitudes').insert({
      user_id: user.id, pago_id: pago.id, monto: pago.monto, estado: 'pendiente',
      tipo: 'factura', pais: 'MX',
      rfc: empresa?.rfc ?? null,
      razon_social: empresa?.razon_social ?? empresa?.nombre_comercial ?? null,
    })
    if (error) toast.error('No se pudo solicitar')
    else { toast.success('Solicitud de factura enviada. Te avisaremos cuando esté lista.'); loadHistorial() }
  }

  return (
    <div className="space-y-6">
      {/* Checkout embebido de Stripe */}
      {clientSecret && stripePromise && (
        <div className="fixed inset-0 bg-navy-950/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-bold text-navy-900">Pago seguro</h2>
              <button onClick={() => setClientSecret(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-2">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-navy-900">Folios y recargas</h1>
        <p className="text-slate-500 text-sm">Cada cotización enviada consume 1 folio. Los borradores no consumen.</p>
      </div>

      {/* Saldo */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #06213B, #08AEB6)' }}>
        <div className="absolute -right-10 -top-10 w-52 h-52 bg-white/5 rounded-full" />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/70 text-xs font-semibold uppercase tracking-wider"><Coins className="w-4 h-4" /> Saldo actual</div>
          <p className="text-5xl font-black mt-2">{profile?.folios_balance ?? 0} <span className="text-2xl font-semibold text-white/70">folios</span></p>
          <p className="text-white/70 text-sm mt-1">Tus folios no caducan y se acumulan con cada recarga.</p>
        </div>
      </div>

      {/* Paquetes */}
      <div>
        <h2 className="text-lg font-bold text-navy-900">Compra más folios</h2>
        <p className="text-slate-500 text-sm mb-4">Selecciona el paquete ideal para tu volumen de cotizaciones.</p>
        <div className="grid sm:grid-cols-3 gap-5">
          {paquetes.map(p => (
            <div key={p.id} className={`card p-6 relative ${p.popular ? 'ring-2 ring-primary-500 shadow-card-hover' : ''}`}>
              {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">Más elegido</span>}
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Paquete</p>
              <h3 className="text-lg font-bold text-navy-900">{p.nombre}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-3xl font-extrabold text-primary-600">{p.folios}</span><span className="text-slate-500 mb-1">folios</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">${(p.precio / p.folios).toFixed(2)} por folio</p>
              <p className="mt-3 text-2xl font-extrabold text-navy-900">${p.precio} <span className="text-sm font-medium text-slate-400">MXN</span></p>
              <button onClick={() => handleCompra(p)} disabled={checkout === p.id}
                className={`mt-4 w-full justify-center ${p.popular ? 'btn-primary' : 'btn-navy'}`}>
                {checkout === p.id ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {checkout === p.id ? 'Conectando...' : 'Comprar paquete'}
              </button>
              <ul className="mt-5 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success-500" /> Sin fecha de caducidad</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success-500" /> Folios acumulables</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success-500" /> Activación inmediata</li>
              </ul>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">🔒 Pago seguro · Activación inmediata · Folios acumulables</p>
      </div>

      {/* Historial */}
      <div>
        <h2 className="text-lg font-bold text-navy-900 mb-3">Historial de recargas</h2>
        {loading ? (
          <div className="card p-6 text-center text-slate-500 text-sm">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Sin recargas aún. Cuando compres tu primer paquete aparecerá aquí.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-slate-50/60">
                  <th className="px-6 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Paquete</th>
                  <th className="px-4 py-3 font-medium">Folios</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">{esMexico ? 'Factura' : 'Nota de remisión'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-500">{formatDate(h.created_at)}</td>
                    <td className="px-4 py-3 text-navy-900">{h.paquete_nombre ?? 'Recarga'}</td>
                    <td className="px-4 py-3 text-success-600 font-semibold">+{h.folios_cantidad ?? 0}</td>
                    <td className="px-4 py-3 font-semibold text-navy-900">{formatCurrency(h.monto, h.moneda)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${h.acreditado || h.estado === 'aprobado' ? 'bg-success-50 text-success-600' : 'bg-amber-50 text-amber-600'}`}>
                        {h.acreditado || h.estado === 'aprobado' ? 'Aprobado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => solicitarFactura(h)} className="text-xs font-medium text-primary-600 hover:underline">
                        Solicitar {esMexico ? 'factura' : 'nota de remisión'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">
          {esMexico
            ? <>¿Necesitas facturar? Configura tu RFC y régimen en <Link to="/app/configuracion" className="text-primary-600 hover:underline">Mi empresa</Link>. El PDF y XML (CFDI) aparecerán aquí cuando administración los cargue.</>
            : <>Fuera de México emitimos una <strong>nota de remisión</strong> con tu ID fiscal para que la deduzcas localmente. Agrégalo en <Link to="/app/configuracion" className="text-primary-600 hover:underline">Mi empresa</Link>. El documento aparecerá aquí cuando esté listo.</>}
        </p>
      </div>
    </div>
  )
}
