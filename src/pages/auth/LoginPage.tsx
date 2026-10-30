import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import SelectorIdioma from '../../components/SelectorIdioma'
import Turnstile from '../../components/Turnstile'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { enApp } from '../../lib/enApp'

// Bloqueo local anti-fuerza-bruta: tras varios intentos fallidos se congela el
// botón unos segundos (complementa el límite del lado servidor de Supabase).
const MAX_INTENTOS = 5
const LOCK_KEY = 'cg_login_lock'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [restante, setRestante] = useState(0)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0) // cambiarlo re-monta el widget (token nuevo)

  // Cuenta regresiva del bloqueo (si lo hay).
  useEffect(() => {
    const tick = () => {
      const hasta = Number(localStorage.getItem(LOCK_KEY) || 0)
      setRestante(Math.max(0, Math.ceil((hasta - Date.now()) / 1000)))
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [])

  const registrarFallo = () => {
    const n = Number(sessionStorage.getItem('cg_login_fails') || 0) + 1
    sessionStorage.setItem('cg_login_fails', String(n))
    if (n >= MAX_INTENTOS) {
      // Bloqueo creciente: 30s, 60s, 120s...
      const segs = Math.min(30 * 2 ** (n - MAX_INTENTOS), 300)
      localStorage.setItem(LOCK_KEY, String(Date.now() + segs * 1000))
    }
  }

  const reiniciarCaptcha = () => { setCaptchaToken(''); setCaptchaKey(k => k + 1) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (restante > 0) { toast.error(t('auth.tooManyTries', { s: restante })); return }
    if (!captchaToken) { toast.error(t('auth.captchaPend')); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password, options: { captchaToken },
    })
    if (error) {
      registrarFallo()
      reiniciarCaptcha() // el token es de un solo uso
      // Mensaje genérico: no revelar si el correo existe o no.
      toast.error(error.message === 'Invalid login credentials' ? t('auth.badCreds') : error.message)
      setLoading(false)
      return
    }
    // Éxito: limpia los contadores.
    sessionStorage.removeItem('cg_login_fails')
    localStorage.removeItem(LOCK_KEY)
    // Redirige según el rol (admin → panel de control).
    const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', data.user!.id).single()
    navigate(prof?.is_admin ? '/admin' : '/app')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><SelectorIdioma variant="oscuro" /></div>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 sm:px-10">
          {/* Logo a color (la tarjeta es blanca, se ve tal cual) */}
          <div className="flex justify-center mb-7">
            <Logo className="h-14" />
          </div>

          <h1 className="text-2xl font-extrabold text-navy-900 text-center">{t('auth.loginTitle')}</h1>
          <p className="text-slate-500 text-sm text-center mt-1.5 mb-8">{t('auth.loginSubtitle')}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="label">{t('auth.email')}</label>
              <input id="login-email" type="email" autoComplete="email" inputMode="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base sm:text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="tu@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

            <div>
              <label htmlFor="login-pass" className="label">{t('auth.password')}</label>
              <div className="relative">
                <input id="login-pass" type={showPass ? 'text' : 'password'} autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-base sm:text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                  placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              <div className="text-right mt-2">
                <Link to="/recuperar" className="text-xs font-semibold text-primary-700 hover:text-primary-700">{t('auth.forgot')}</Link>
              </div>
            </div>

            <Turnstile key={captchaKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />

            <button type="submit" disabled={loading || restante > 0 || !captchaToken}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-navy-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25">
              {/* El texto del botón ya dice «Entrando…»: el giro es decorativo */}
              {loading && <span aria-hidden="true" className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />}
              {restante > 0 ? t('auth.tooManyTries', { s: restante }) : loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          {/* En las apps (Android e iPhone) solo se entra: la cuenta se crea en la web. Decisión de Omar, 30-oct-2026. */}
          {!enApp() && (
            <p className="text-center text-sm text-slate-500 mt-7">
              {t('auth.noAccount')}{' '}
              <Link to="/registro" className="text-primary-700 hover:text-primary-700 font-semibold">{t('auth.createFree')}</Link>
            </p>
          )}
        </div>

        <p className="text-center text-white/50 text-xs mt-6">{t('auth.rights')}</p>
      </div>
    </div>
  )
}
