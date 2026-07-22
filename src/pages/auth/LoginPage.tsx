import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message)
      setLoading(false)
      return
    }
    // Redirige según el rol (admin → panel de control).
    const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', data.user!.id).single()
    navigate(prof?.is_admin ? '/admin' : '/app')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 sm:px-10">
          {/* Logo a color (la tarjeta es blanca, se ve tal cual) */}
          <div className="flex justify-center mb-7">
            <Logo className="h-10" />
          </div>

          <h1 className="text-2xl font-extrabold text-navy-900 text-center">Inicia sesión</h1>
          <p className="text-slate-500 text-sm text-center mt-1.5 mb-8">Ingresa tus datos para entrar a la plataforma.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="tu@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Ingresando...' : 'Entrar a Cotiza Go'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-7">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/registro" className="text-primary-600 hover:text-primary-700 font-semibold">Crea tu cuenta gratis</Link>
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">© 2026 Cotiza Go · Todos los derechos reservados</p>
      </div>
    </div>
  )
}
