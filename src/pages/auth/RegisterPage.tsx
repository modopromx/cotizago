import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { FileText, Eye, EyeOff, Check, Zap } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ nombre: '', empresa: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  // Plan seleccionado desde landing
  const planNombre = searchParams.get('nombre') ?? ''
  const planFolios = parseInt(searchParams.get('folios') ?? '0')
  const planPrecio = parseInt(searchParams.get('precio') ?? '0')
  const planPriceId = searchParams.get('plan') ?? ''
  const hasPlan = planFolios > 0

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) { toast.error('Mínimo 6 caracteres para la contraseña'); return }
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (error) {
      toast.error(error.message === 'User already registered' ? 'Este correo ya está registrado' : error.message)
      setLoading(false)
      return
    }

    // Actualizar perfil
    if (data.user) {
      await supabase.from('profiles').update({
        nombre: form.nombre,
        empresa: form.empresa,
      }).eq('id', data.user.id)
    }

    if (hasPlan && planPriceId) {
      // Redirigir a Stripe Checkout
      toast.success('¡Cuenta creada! Redirigiendo al pago...')
      // Por ahora redirigir al app — cuando Stripe esté configurado, se redirige a checkout
      setTimeout(() => navigate(`/app?pago_pendiente=true&plan=${planPriceId}`), 1500)
    } else {
      toast.success('¡Cuenta creada! Bienvenido a CotizaGo.')
      navigate('/app')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 text-white mb-2 hover:opacity-80 transition-opacity">
            <img src="/logo-icon.svg" width={38} height={45} alt="CotizaGo" />
            <span className="text-2xl font-bold">CotizaGo</span>
          </Link>
          <p className="text-slate-400 text-sm mt-1">La forma más rápida de cotizar en LATAM</p>
        </div>

        {/* Plan seleccionado */}
        {hasPlan && (
          <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Has seleccionado: {planNombre}</p>
                <p className="text-primary-300 text-xs">{planFolios} folios · ${planPrecio} MXN · pago único</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold">${planPrecio}</p>
                <p className="text-primary-400 text-xs">MXN</p>
              </div>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-slate-800 mb-1">
            {hasPlan ? 'Crea tu cuenta y paga' : 'Crear cuenta gratis'}
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            {hasPlan ? `Paso 1 de 2: Crea tu cuenta para continuar al pago` : 'Empieza en 30 segundos. Sin tarjeta requerida.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tu nombre *</label>
                <input type="text" className="input" placeholder="Alan" value={form.nombre} onChange={set('nombre')} required />
              </div>
              <div>
                <label className="label">Empresa</label>
                <input type="text" className="input" placeholder="Mi Empresa" value={form.empresa} onChange={set('empresa')} />
              </div>
            </div>
            <div>
              <label className="label">Correo electrónico *</label>
              <input type="email" className="input" placeholder="tu@empresa.com" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label className="label">Contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="Mínimo 6 caracteres" value={form.password} onChange={set('password')} required minLength={6} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {hasPlan ? 'Crear cuenta y continuar al pago →' : 'Crear cuenta gratis'}
            </button>
          </form>

          {!hasPlan && (
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-500" /> Sin tarjeta</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-500" /> Sin contrato</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-500" /> Soporte en español</span>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-5">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">Iniciar sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
