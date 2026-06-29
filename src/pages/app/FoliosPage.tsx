import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency, formatDatetime } from '../../lib/utils'
import toast from 'react-hot-toast'
import { Zap, Star, Clock, CheckCircle, XCircle } from 'lucide-react'

const PAQUETES_FALLBACK = [
  { nombre: 'Pack 100', folios: 100, precio: 149, moneda: 'MXN', popular: false, orden: 1, id: '1' },
  { nombre: 'Pack 300', folios: 300, precio: 349, moneda: 'MXN', popular: true, orden: 2, id: '2' },
  { nombre: 'Pack 800', folios: 800, precio: 599, moneda: 'MXN', popular: false, orden: 3, id: '3' },
]

export default function FoliosPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [searchParams] = useSearchParams()
  const [paquetes, setPaquetes] = useState<any[]>([])
  const [historial, setHistorial] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  // Mostrar resultado de pago si viene redirect de Stripe
  useEffect(() => {
    const pago = searchParams.get('pago')
    const folios = searchParams.get('folios')
    if (pago === 'exitoso') {
      toast.success(`¡Pago exitoso! Se acreditaron ${folios} folios a tu cuenta.`)
      refreshProfile()
    } else if (pago === 'cancelado') {
      toast.error('Pago cancelado. Puedes intentarlo de nuevo cuando quieras.')
    }
  }, [])

  useEffect(() => {
    supabase.from('paquetes_folios').select('*').eq('activo', true).order('orden').then(({ data }) => {
      setPaquetes(data && data.length > 0 ? data : PAQUETES_FALLBACK)
    })
    if (user) {
      supabase.from('pagos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
        setHistorial(data ?? [])
        setLoading(false)
      })
    }
  }, [user])

  const handleCompra = async (paquete: any) => {
    if (!user) return
    setCheckoutLoading(paquete.id)

    try {
      // Obtener token de sesión
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Sesión expirada. Vuelve a iniciar sesión.'); return }

      // Llamar Edge Function para crear Stripe Checkout
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: paquete.stripe_price_id ?? `pack_${paquete.folios}`,
          folios: paquete.folios,
          paquete_nombre: paquete.nombre,
          precio: paquete.precio,
        }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        // Stripe no configurado aún — mostrar instrucción
        toast('Pago por WhatsApp: envíanos el pack que deseas y te enviamos el link de pago.', {
          icon: '💬',
          duration: 6000,
        })
      }
    } catch (err) {
      toast.error('Error al conectar con el sistema de pagos. Contáctanos por WhatsApp.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Folios</h1>
        <p className="text-slate-500 text-sm">Cada cotización enviada consume 1 folio. Los borradores no consumen folios.</p>
      </div>

      {/* Balance hero */}
      <div className="bg-gradient-to-r from-primary-600 to-navy-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-primary-300" />
              <span className="text-primary-200 text-sm font-medium">Saldo disponible</span>
            </div>
            <p className="text-6xl font-black mb-1">{profile?.folios_balance ?? 0}</p>
            <p className="text-primary-200 text-sm">folios · equivalen a {profile?.folios_balance ?? 0} cotizaciones</p>
          </div>
          {(profile?.folios_balance ?? 0) > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <CheckCircle className="w-5 h-5 text-emerald-300" />
              <span className="text-white text-sm font-medium">Cuenta activa</span>
            </div>
          )}
        </div>
      </div>

      {/* Paquetes */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Recargar folios</h2>
        <p className="text-slate-500 text-sm mb-4">Pago único con tarjeta. Sin mensualidades, sin contratos.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {paquetes.map(p => (
            <div key={p.id} className={`card p-5 relative transition-all hover:shadow-md ${p.popular ? 'border-primary-300 ring-2 ring-primary-200 shadow-lg shadow-primary-100' : ''}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                    <Star className="w-3 h-3 fill-white" /> MÁS POPULAR
                  </span>
                </div>
              )}
              <div className="text-center pt-2">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{p.nombre}</p>
                <p className="text-4xl font-black text-slate-800 mb-0.5">{p.folios}</p>
                <p className="text-slate-500 text-xs mb-4">folios · ${(p.precio / p.folios).toFixed(2)} c/u</p>
                <div className="flex items-baseline justify-center gap-1 mb-5">
                  <span className="text-slate-500 text-sm">$</span>
                  <span className="text-3xl font-bold text-slate-900">{p.precio}</span>
                  <span className="text-slate-500 text-sm">MXN</span>
                </div>
                <button
                  onClick={() => handleCompra(p)}
                  disabled={checkoutLoading === p.id}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${p.popular ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-300/30' : 'bg-slate-900 hover:bg-slate-700 text-white'}`}
                >
                  {checkoutLoading === p.id
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : null
                  }
                  {checkoutLoading === p.id ? 'Conectando...' : `Comprar ${p.nombre}`}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 justify-center mt-4 text-xs text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Pago 100% seguro con Stripe · Tarjeta o OXXO Pay
        </div>
      </div>

      {/* Historial */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Historial de recargas</h2>
        {loading ? (
          <div className="card p-6 text-center text-slate-500 text-sm">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="card p-8 text-center">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Sin recargas aún. Cuando compres tu primer pack aparecerá aquí.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Paquete</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Folios</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Monto</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{h.paquete_nombre ?? 'Recarga'}</td>
                    <td className="px-4 py-3 text-emerald-600 font-semibold">+{h.folios_cantidad}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(h.monto, h.moneda)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge flex items-center gap-1 w-fit ${h.estado === 'aprobado' ? 'bg-green-100 text-green-700' : h.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {h.estado === 'aprobado' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {h.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDatetime(h.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Necesitas factura */}
      <div className="card p-4 bg-slate-50 border-dashed">
        <p className="text-sm text-slate-600">
          ¿Necesitas factura por tu compra?{' '}
          <a href="https://wa.me/521234567890" className="text-primary-600 hover:underline font-medium">
            Escríbenos a WhatsApp
          </a>{' '}
          con tu RFC y te la enviamos en 24 hrs.
        </p>
      </div>
    </div>
  )
}
