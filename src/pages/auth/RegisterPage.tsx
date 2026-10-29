import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import SelectorIdioma from '../../components/SelectorIdioma'
import Turnstile from '../../components/Turnstile'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Check, Gift, Zap } from 'lucide-react'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ nombre: '', empresa: '', telefono: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)
  const reiniciarCaptcha = () => { setCaptchaToken(''); setCaptchaKey(k => k + 1) }

  const planNombre = searchParams.get('nombre') ?? ''
  const planFolios = parseInt(searchParams.get('folios') ?? '0')
  const planPrecio = parseInt(searchParams.get('precio') ?? '0')
  const planPriceId = searchParams.get('plan') ?? ''
  const hasPlan = planFolios > 0

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error(t('auth.passMin')); return }
    // Exige algo de complejidad: al menos una letra y un número.
    if (!/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password)) { toast.error(t('auth.passWeak')); return }
    if (!captchaToken) { toast.error(t('auth.captchaPend')); return }
    setLoading(true)

    // El candado anti-duplicados (nombre completo y teléfono) corre en la base al
    // crear la cuenta (trigger antes_de_registrar), detrás del captcha. Antes era una
    // consulta que cualquiera podía hacer sin cuenta para saber quién es cliente.
    const { data, error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { captchaToken, data: { nombre: form.nombre, empresa: form.empresa, telefono: form.telefono } },
    })
    if (error) {
      // Supabase no deja pasar el texto del trigger: llega como «Database error saving new user».
      const dup = /database error saving new user|registro_duplicado/i.test(error.message)
      toast.error(error.message === 'User already registered' ? t('auth.emailTaken') : dup ? t('auth.dupGeneric') : error.message)
      reiniciarCaptcha()
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('profiles').update({
        nombre: form.nombre, empresa: form.empresa, telefono: form.telefono,
      }).eq('id', data.user.id)

      // Programa de referidos: si venía con ?ref=CODIGO, se registra quién lo invitó.
      // La recompensa (para ambos) se libera cuando este usuario haga su primer pago.
      let refCode = searchParams.get('ref') || ''
      try { if (!refCode) refCode = localStorage.getItem('cg_ref') || '' } catch { /* */ }
      if (refCode) {
        try { await supabase.rpc('aplicar_referido', { codigo: refCode }) } catch { /* no bloquear el registro */ }
        try { localStorage.removeItem('cg_ref') } catch { /* */ }
      }

      // Correo de bienvenida (si hay sesión; con confirmación de correo desactivada, siempre la hay).
      if (data.session) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ clave: 'bienvenida' }),
        }).catch(() => { /* no bloquear el registro si falla el correo */ })
      }
    }

    // Viene de «Elegir» un paquete en la portada: al crear la cuenta va directo a
    // pagarlo (antes caía en el panel y el paquete elegido se perdía).
    if (planPriceId) {
      toast.success(hasPlan ? t('auth.createdPlan') : t('auth.created'))
      navigate(`/app/folios?paquete=${encodeURIComponent(planPriceId)}`)
    } else {
      toast.success(t('auth.created'))
      navigate('/app')
    }
    setLoading(false)
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-base sm:text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent'

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><SelectorIdioma variant="oscuro" /></div>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-9 sm:px-10">
          <div className="flex justify-center mb-6">
            <Link to="/" className="hover:opacity-80 transition-opacity"><Logo className="h-14" /></Link>
          </div>

          <h1 className="text-2xl font-extrabold text-navy-900 text-center">
            {hasPlan ? t('auth.registerTitlePlan') : t('auth.registerTitle')}
          </h1>
          <p className="text-slate-500 text-sm text-center mt-1.5 mb-6">
            {hasPlan ? t('auth.registerSubtitlePlan') : t('auth.registerSubtitle')}
          </p>

          {hasPlan && (
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3.5 mb-5 flex items-center gap-3">
              <span className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="text-navy-900 font-semibold text-sm">{planNombre}</p>
                <p className="text-slate-500 text-xs">{planFolios} {t('pricing.foliosWord')} · ${planPrecio} MXN · {t('auth.singlePayment')}</p>
              </div>
            </div>
          )}

          {!hasPlan && (
            <div className="flex items-center gap-2 rounded-xl bg-success-50 border border-success-100 px-3.5 py-2.5 mb-5">
              <Gift className="w-4 h-4 text-success-700 shrink-0" aria-hidden="true" />
              <p className="text-xs text-success-800"><strong>{t('auth.freeFolios')}</strong> {t('auth.freeFoliosTail')}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Una columna en teléfono: a 375px dos columnas cortaban el correo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-nombre" className="label">{t('auth.name')}</label>
                <input id="reg-nombre" type="text" autoComplete="name" className={inputClass} placeholder="Alan Velázquez" value={form.nombre} onChange={set('nombre')} required />
              </div>
              <div>
                <label htmlFor="reg-empresa" className="label">{t('auth.company')}</label>
                <input id="reg-empresa" type="text" autoComplete="organization" className={inputClass} placeholder="Mi Empresa" value={form.empresa} onChange={set('empresa')} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-telefono" className="label">{t('auth.phone')}</label>
                <input id="reg-telefono" type="tel" autoComplete="tel" inputMode="tel" className={inputClass} placeholder="55 1234 5678" value={form.telefono} onChange={set('telefono')} />
              </div>
              <div>
                <label htmlFor="reg-email" className="label">{t('auth.emailReq')}</label>
                <input id="reg-email" type="email" autoComplete="email" inputMode="email" className={inputClass} placeholder="tu@empresa.com" value={form.email} onChange={set('email')} required />
              </div>
            </div>
            <div>
              <label htmlFor="reg-pass" className="label">{t('auth.passwordReq')}</label>
              <div className="relative">
                <input id="reg-pass" type={showPass ? 'text' : 'password'} className={`${inputClass} pr-11`} placeholder={t('auth.passwordPlaceholder')}
                  value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <Turnstile key={captchaKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />

            <button type="submit" disabled={loading || !captchaToken}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-navy-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25 mt-1">
              {loading && <span role="status" aria-label="Creando cuenta…" className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />}
              {hasPlan ? t('auth.createContinue') : t('auth.createFreeBtn')}
            </button>
          </form>

          {!hasPlan && (
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-700" aria-hidden="true" /> {t('auth.noCard')}</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-700" aria-hidden="true" /> {t('auth.noContract')}</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-primary-700" aria-hidden="true" /> {t('auth.inSpanish')}</span>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary-700 hover:text-primary-700 font-semibold">{t('auth.doSignIn')}</Link>
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">{t('auth.rights')}</p>
      </div>
    </div>
  )
}
