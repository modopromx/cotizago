// «¿Olvidaste tu contraseña?» — pide el correo y Supabase manda el enlace de
// recuperación, que regresa a /nueva-contrasena. La respuesta es SIEMPRE la misma
// exista o no la cuenta (no revela quién está registrado), y lleva el mismo
// CAPTCHA que el login porque Supabase lo exige en todos los endpoints de Auth.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import SelectorIdioma from '../../components/SelectorIdioma'
import Turnstile from '../../components/Turnstile'
import toast from 'react-hot-toast'
import { MailCheck } from 'lucide-react'

export default function RecuperarPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaKey, setCaptchaKey] = useState(0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captchaToken) { toast.error(t('auth.captchaPend')); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-contrasena`,
      captchaToken,
    })
    setLoading(false)
    // Solo se avisa de errores que no revelan nada (captcha, demasiados intentos).
    // «Usuario no encontrado» nunca llega aquí: Supabase responde igual.
    if (error && /captcha|rate|too many|security/i.test(error.message)) {
      toast.error(error.message)
      setCaptchaToken(''); setCaptchaKey(k => k + 1)
      return
    }
    setEnviado(true)
  }

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><SelectorIdioma variant="oscuro" /></div>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 sm:px-10">
          <div className="flex justify-center mb-7">
            <Logo className="h-14" />
          </div>

          {enviado ? (
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-5">
                <MailCheck className="w-7 h-7 text-primary-700" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-extrabold text-navy-900">{t('auth.recSentTitle')}</h1>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">{t('auth.recSentDesc', { email: email.trim() })}</p>
              <Link to="/login" className="inline-block mt-8 text-primary-700 hover:text-primary-700 font-semibold text-sm">
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-extrabold text-navy-900 text-center">{t('auth.recTitle')}</h1>
              <p className="text-slate-500 text-sm text-center mt-1.5 mb-8">{t('auth.recSubtitle')}</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="rec-email" className="label">{t('auth.email')}</label>
                  <input id="rec-email" type="email" autoComplete="email" inputMode="email"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-base sm:text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                    placeholder="tu@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                <Turnstile key={captchaKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />

                <button type="submit" disabled={loading || !captchaToken}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-navy-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25">
                  {/* El texto del botón ya anuncia «Enviando…»: el giro es decorativo */}
                  {loading && <span aria-hidden="true" className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />}
                  {loading ? t('auth.recSending') : t('auth.recSend')}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-7">
                <Link to="/login" className="text-primary-700 hover:text-primary-700 font-semibold">{t('auth.backToLogin')}</Link>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-white/50 text-xs mt-6">{t('auth.rights')}</p>
      </div>
    </div>
  )
}
