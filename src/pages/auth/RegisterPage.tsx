import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Check, Gift, Zap } from 'lucide-react'

const DUPLICADO_MSG: Record<string, string> = {
  email: 'Este correo ya está registrado.',
  nombre: 'Ya existe una cuenta con ese nombre. Si es tuya, inicia sesión.',
  telefono: 'Ese teléfono ya está registrado en otra cuenta.',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ nombre: '', empresa: '', telefono: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

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

    // Candado anti-duplicados (nombre completo, teléfono, email) antes de crear la cuenta.
    const { data: dup } = await supabase.rpc('verificar_duplicado', {
      p_user_id: null, p_nombre: form.nombre, p_telefono: form.telefono, p_email: form.email,
    })
    if (dup) {
      toast.error(DUPLICADO_MSG[dup as string] ?? 'Datos ya registrados en otra cuenta.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) {
      toast.error(error.message === 'User already registered' ? 'Este correo ya está registrado' : error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').update({
        nombre: form.nombre, empresa: form.empresa, telefono: form.telefono,
      }).eq('id', data.user.id)

      // Correo de bienvenida (si hay sesión; con confirmación de correo desactivada, siempre la hay).
      if (data.session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({
            clave: 'bienvenida', para: form.email,
            variables: { nombre: form.nombre, email: form.email, folios: '5', link_recarga: `${window.location.origin}/app` },
          }),
        }).catch(() => { /* no bloquear el registro si falla el correo */ })
      }
    }

    if (hasPlan && planPriceId) {
      toast.success('¡Cuenta creada! Redirigiendo al pago...')
      setTimeout(() => navigate(`/app?pago_pendiente=true&plan=${planPriceId}`), 1200)
    } else {
      toast.success('¡Cuenta creada! Bienvenido a Cotiza Go.')
      navigate('/app')
    }
    setLoading(false)
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent'

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-9 sm:px-10">
          <div className="flex justify-center mb-6">
            <Link to="/" className="hover:opacity-80 transition-opacity"><Logo className="h-10" /></Link>
          </div>

          <h1 className="text-2xl font-extrabold text-navy-900 text-center">
            {hasPlan ? 'Crea tu cuenta' : 'Crear cuenta gratis'}
          </h1>
          <p className="text-slate-500 text-sm text-center mt-1.5 mb-6">
            {hasPlan ? 'Paso 1 de 2 · continúa al pago' : 'Empieza en 30 segundos. Sin tarjeta requerida.'}
          </p>

          {hasPlan && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3.5 mb-5 flex items-center gap-3">
              <span className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </span>
              <div className="flex-1">
                <p className="text-navy-900 font-semibold text-sm">{planNombre}</p>
                <p className="text-slate-500 text-xs">{planFolios} folios · ${planPrecio} MXN · pago único</p>
              </div>
            </div>
          )}

          {!hasPlan && (
            <div className="flex items-center gap-2 rounded-xl bg-success-50 border border-success-100 px-3.5 py-2.5 mb-5">
              <Gift className="w-4 h-4 text-success-600 shrink-0" />
              <p className="text-xs text-success-800"><strong>5 folios de prueba gratis</strong> al crear tu cuenta.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre y apellido *</label>
                <input type="text" className={inputClass} placeholder="Alan Velázquez" value={form.nombre} onChange={set('nombre')} required />
              </div>
              <div>
                <label className="label">Empresa</label>
                <input type="text" className={inputClass} placeholder="Mi Empresa" value={form.empresa} onChange={set('empresa')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Teléfono</label>
                <input type="tel" className={inputClass} placeholder="55 1234 5678" value={form.telefono} onChange={set('telefono')} />
              </div>
              <div>
                <label className="label">Correo *</label>
                <input type="email" className={inputClass} placeholder="tu@empresa.com" value={form.email} onChange={set('email')} required />
              </div>
            </div>
            <div>
              <label className="label">Contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className={`${inputClass} pr-11`} placeholder="Mínimo 6 caracteres"
                  value={form.password} onChange={set('password')} required minLength={6} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25 mt-1">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {hasPlan ? 'Crear cuenta y continuar →' : 'Crear mi cuenta gratis'}
            </button>
          </form>

          {!hasPlan && (
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-500" /> Sin tarjeta</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-500" /> Sin contrato</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-500" /> En español</span>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">Inicia sesión</Link>
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">© 2026 Cotiza Go · Todos los derechos reservados</p>
      </div>
    </div>
  )
}
