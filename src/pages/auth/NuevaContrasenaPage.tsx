// Destino del enlace de recuperación. Supabase abre una sesión temporal con el
// token del correo (lo lee del URL solo, detectSessionInUrl); aquí se pide la
// nueva contraseña con las mismas reglas del registro y se guarda con updateUser.
// Si en ~4 s no aparece sesión, el enlace es inválido o venció.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import SelectorIdioma from '../../components/SelectorIdioma'
import toast from 'react-hot-toast'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

type Estado = 'verificando' | 'listo' | 'invalido'

export default function NuevaContrasenaPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [ver, setVer] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let vivo = true
    const marcarListo = () => { if (vivo) setEstado('listo') }
    supabase.auth.getSession().then(({ data }) => { if (data.session) marcarListo() })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((ev, session) => {
      if (session && (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) marcarListo()
    })
    const limite = setTimeout(() => { if (vivo) setEstado(e => (e === 'verificando' ? 'invalido' : e)) }, 4000)
    return () => { vivo = false; subscription.unsubscribe(); clearTimeout(limite) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pass.length < 8) { toast.error(t('auth.passMin')); return }
    if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) { toast.error(t('auth.passWeak')); return }
    if (pass !== pass2) { toast.error(t('auth.passMismatch')); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(t('auth.passUpdated'))
    navigate('/app')
  }

  const inputClass = 'w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 text-base sm:text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent'

  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4"><SelectorIdioma variant="oscuro" /></div>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl px-8 py-10 sm:px-10">
          <div className="flex justify-center mb-7">
            <Logo className="h-14" />
          </div>

          {estado === 'verificando' && (
            <div className="flex flex-col items-center gap-3 py-6" role="status">
              <span aria-hidden="true" className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">{t('auth.checkingLink')}</p>
            </div>
          )}

          {estado === 'invalido' && (
            <div className="text-center">
              <h1 className="text-xl font-extrabold text-navy-900">{t('auth.linkInvalid')}</h1>
              <Link to="/recuperar" className="inline-flex mt-6 items-center justify-center py-3 px-6 rounded-xl bg-primary-500 hover:bg-primary-400 text-navy-900 font-semibold text-sm">
                {t('auth.requestNew')}
              </Link>
              <p className="mt-5"><Link to="/login" className="text-primary-700 hover:text-primary-700 font-semibold text-sm">{t('auth.backToLogin')}</Link></p>
            </div>
          )}

          {estado === 'listo' && (
            <>
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-5">
                <KeyRound className="w-7 h-7 text-primary-700" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-extrabold text-navy-900 text-center">{t('auth.newPassTitle')}</h1>
              <p className="text-slate-500 text-sm text-center mt-1.5 mb-8">{t('auth.newPassSubtitle')}</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="np-1" className="label">{t('auth.newPass')}</label>
                  <div className="relative">
                    <input id="np-1" type={ver ? 'text' : 'password'} autoComplete="new-password" className={inputClass}
                      placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} required minLength={8} />
                    <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-600">
                      {ver ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="np-2" className="label">{t('auth.confirmPass')}</label>
                  <input id="np-2" type={ver ? 'text' : 'password'} autoComplete="new-password" className={inputClass}
                    placeholder="••••••••" value={pass2} onChange={e => setPass2(e.target.value)} required minLength={8} />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-navy-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25">
                  {/* El texto del botón ya anuncia «Guardando…»: el giro es decorativo */}
                  {loading && <span aria-hidden="true" className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" />}
                  {loading ? t('auth.savingPass') : t('auth.savePass')}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-white/50 text-xs mt-6">{t('auth.rights')}</p>
      </div>
    </div>
  )
}
