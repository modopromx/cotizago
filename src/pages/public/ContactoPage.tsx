// Página pública de contacto: solo un formulario (nombre, correo, mensaje) que
// envía al buzón de la plataforma vía la edge function `contacto`, junto a una
// imagen de referencia (mockup) del panel de usuario de Cotiza Go.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Logo from '../../components/Logo'
import NavPublica from '../../components/NavPublica'
import toast from 'react-hot-toast'
import { Send, FileText, Zap, Check } from 'lucide-react'

export default function ContactoPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState({ nombre: '', email: '', mensaje: '', website: '' })
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contacto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('fail')
      toast.success(t('contacto.ok'))
      setForm({ nombre: '', email: '', mensaje: '', website: '' })
    } catch {
      toast.error(t('contacto.err'))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 text-base sm:text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent'

  return (
    <div className="min-h-screen bg-slate-50">
      <NavPublica />

      <main className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Formulario */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <h1 className="text-3xl font-extrabold text-navy-900">{t('contacto.title')}</h1>
            <p className="text-slate-500 mt-2 mb-7">{t('contacto.subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot anti-bots: oculto para humanos, invisible a lectores */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={form.website} onChange={set('website')}
                className="absolute left-[-9999px] w-px h-px opacity-0" />
              <div>
                <label htmlFor="contacto-nombre" className="label">{t('contacto.nombre')}</label>
                <input id="contacto-nombre" type="text" autoComplete="name" className={inputClass} placeholder={t('contacto.nombrePh')}
                  value={form.nombre} onChange={set('nombre')} required />
              </div>
              <div>
                <label htmlFor="contacto-email" className="label">{t('contacto.email')}</label>
                <input id="contacto-email" type="email" autoComplete="email" inputMode="email" className={inputClass} placeholder={t('contacto.emailPh')}
                  value={form.email} onChange={set('email')} required />
              </div>
              <div>
                <label htmlFor="contacto-mensaje" className="label">{t('contacto.mensaje')}</label>
                <textarea id="contacto-mensaje" className={`${inputClass} min-h-[130px] resize-y`} placeholder={t('contacto.mensajePh')}
                  value={form.mensaje} onChange={set('mensaje')} required maxLength={4000} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-navy-900 font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-primary-500/25">
                {loading
                  ? <><span aria-hidden="true" className="w-4 h-4 border-2 border-navy-900 border-t-transparent rounded-full animate-spin" /> {t('contacto.enviando')}</>
                  : <><Send className="w-4 h-4" aria-hidden="true" /> {t('contacto.enviar')}</>}
              </button>
            </form>
          </div>

          {/* Imagen de referencia: panel de usuario de Cotiza Go */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 bg-gradient-to-tr from-primary-100 via-primary-50 to-transparent rounded-[2rem] blur-2xl opacity-70" />
            <PanelMockup />
          </div>
        </div>
      </main>
    </div>
  )
}

// Mockup visual del panel de usuario (mismo estilo que el hero de la landing).
function PanelMockup() {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <p className="text-center text-navy-900 font-bold text-lg mb-1">{t('contacto.panelTitle')}</p>
      <p className="text-center text-slate-500 text-sm mb-5 max-w-sm mx-auto">{t('contacto.panelDesc')}</p>

      {/* Ilustración: no es interactiva, se oculta a lectores de pantalla */}
      <div aria-hidden="true" className="bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200/70 overflow-hidden">
        {/* Barra superior */}
        <div className="bg-navy-900 px-5 py-3.5 flex items-center justify-between">
          <span className="inline-flex items-center bg-white rounded-lg px-2.5 py-1.5">
            <Logo className="h-5" />
          </span>
          <span className="text-white/90 text-xs font-medium">{t('contacto.mockHi')}</span>
        </div>

        <div className="p-5 space-y-4">
          {/* CTA */}
          <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-500 text-navy-900 text-sm font-semibold">
            <Zap className="w-4 h-4" /> {t('contacto.mockNueva')}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="text-[11px] text-slate-500">{t('contacto.mockCotizado')}</p>
              <p className="text-xl font-extrabold text-navy-900 mt-1">$128,400</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
              <p className="text-[11px] text-slate-500">{t('contacto.mockAceptacion')}</p>
              <p className="text-xl font-extrabold text-primary-700 mt-1">72%</p>
            </div>
          </div>

          {/* Lista de cotizaciones recientes */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">{t('contacto.mockRecientes')}</p>
            <div className="space-y-2">
              {['Constructora Vega', 'Diseño Aurora', 'Taller Mecánico RM'].map((n, i) => (
                <div key={n} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{n}</p>
                    <p className="text-[11px] text-slate-500">COT-00{i + 1}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 bg-primary-50 rounded-full px-2 py-1">
                    <Check className="w-3 h-3" /> {t('contacto.mockEnviada')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
            <FileText className="w-3.5 h-3.5" /> PDF · WhatsApp · Email
          </div>
        </div>
      </div>
    </div>
  )
}
