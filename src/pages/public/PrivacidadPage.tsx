// Página pública de aviso de privacidad de Cotiza Go (ModoPro).
import { useTranslation } from 'react-i18next'
import NavPublica from '../../components/NavPublica'
import { ShieldCheck } from 'lucide-react'

export default function PrivacidadPage() {
  const { t } = useTranslation()
  const secciones = ['s1', 's2', 's3', 's4', 's5', 's6', 's7']

  return (
    <div className="min-h-screen bg-slate-50">
      <NavPublica />

      <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-xl bg-primary-500 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold text-navy-900">{t('priv.title')}</h1>
            <p className="text-slate-500 text-sm">{t('priv.actualizado')}</p>
          </div>
        </div>

        <p className="text-slate-600 mt-6 leading-relaxed">{t('priv.intro')}</p>

        <div className="mt-8 space-y-7">
          {secciones.map(s => (
            <section key={s}>
              <h2 className="text-lg font-bold text-navy-900">{t(`priv.${s}t`)}</h2>
              <p className="text-slate-600 mt-2 leading-relaxed">{t(`priv.${s}d`)}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-primary-50 border border-primary-100 px-5 py-4 text-sm text-primary-800">
          {t('priv.contacto')}
        </div>
      </main>
    </div>
  )
}
