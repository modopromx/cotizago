import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText, MessageCircle, Mail, Smartphone, RefreshCw,
  ArrowRight, Play, Check, Pencil, Send, Menu, X,
  Home, Users, Settings, TrendingUp, Plus,
} from 'lucide-react'
import Logo from '../../components/Logo'
import SelectorIdioma from '../../components/SelectorIdioma'
import { usePaquetes, precioDe, fmtPrecio, SIMBOLO_MONEDA } from '../../lib/usePaquetes'
import { trPaquete } from '../../lib/i18n'

const NAV = [
  { key: 'nav.features', href: '#funciones' },
  { key: 'nav.how', href: '#como-funciona' },
  { key: 'nav.pricing', href: '#paquetes' },
]

function Nav() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  // Escape cierra el menú móvil.
  useEffect(() => {
    if (!open) return
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [open])

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <nav aria-label="Principal" className="hidden md:flex items-center gap-8">
          {NAV.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-navy-700 hover:text-primary-700 transition-colors">{t(l.key)}</a>
          ))}
          <Link to="/contacto" className="text-sm font-medium text-navy-700 hover:text-primary-700 transition-colors">{t('footer.contact')}</Link>
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <SelectorIdioma />
          <Link to="/login" className="text-sm font-medium text-navy-700 hover:text-primary-700 transition-colors">{t('nav.login')}</Link>
          <Link to="/registro" className="btn-navy">{t('nav.start')}</Link>
        </div>
        <div className="md:hidden flex items-center gap-1">
          <SelectorIdioma />
          <button type="button" className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-navy-900 hover:bg-slate-100"
            onClick={() => setOpen(o => !o)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls="menu-landing-movil">
            {open ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-landing-movil" aria-label="Principal" className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
          {NAV.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-navy-700">{t(l.key)}</a>
          ))}
          <Link to="/contacto" onClick={() => setOpen(false)} className="block text-sm font-medium text-navy-700">{t('footer.contact')}</Link>
          <Link to="/login" className="block text-sm font-medium text-navy-700">{t('nav.login')}</Link>
          <Link to="/registro" className="btn-navy w-full justify-center">{t('nav.start')}</Link>
        </nav>
      )}
    </header>
  )
}

/** El video de venta (narrado en español): solo se muestra con la página en español. */
const VIDEO_ES = '/video/cotizago-venta-v2.mp4'
const VIDEO_POSTER = '/video/cotizago-venta-v2.jpg'
const esEspanol = (lang: string) => lang.startsWith('es')

function Hero() {
  const { t, i18n } = useTranslation()
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute -right-32 top-10 w-96 h-96 rounded-full bg-primary-100/50 blur-3xl -z-10" />
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-700 uppercase">
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary-500" /> {t('hero.badge')}
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-navy-900 leading-[1.1]">
            {t('hero.title1')}<br /><span className="text-primary-600">{t('hero.title2')}</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-md">{t('hero.subtitle')}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/registro" className="btn-navy px-6 py-3 text-base justify-center">
              {t('hero.cta1')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <a href={esEspanol(i18n.language) ? '#video' : '#como-funciona'} className="btn-secondary px-6 py-3 text-base justify-center">
              <Play className="w-4 h-4" aria-hidden="true" /> {t('hero.cta2')}
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {[t('hero.check1'), t('hero.check2'), t('hero.check3')].map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <Check className="w-4 h-4 text-success-500" aria-hidden="true" /> {c}
              </span>
            ))}
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  )
}

/** Sección del video de venta, justo debajo del gancho: quien llega de un anuncio
 *  quiere ver qué es esto antes de leer. Mismo look oscuro del video (el azul
 *  profundo del menú de la app con brillos turquesa). preload="metadata" para no
 *  bajarle 7 MB a quien no le dé play; playsInline para que en iPhone no salte a
 *  pantalla completa. El nombre lleva versión (-v2) por la caché del navegador. */
function VideoVenta() {
  const { i18n } = useTranslation()
  if (!esEspanol(i18n.language)) return null
  return (
    <section id="video" className="relative overflow-hidden bg-navy-950 py-20 scroll-mt-16">
      <div aria-hidden="true" className="absolute -right-40 -top-40 w-[34rem] h-[34rem] rounded-full bg-primary-500/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -left-40 -bottom-48 w-[30rem] h-[30rem] rounded-full bg-primary-400/10 blur-3xl" />
      <div className="relative max-w-5xl mx-auto px-4 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-300 uppercase">
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary-400" /> En menos de dos minutos
        </span>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white leading-tight">
          Míralo funcionando, <span className="text-primary-400">de principio a fin</span>
        </h2>
        <div className="mt-10 rounded-2xl overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,.5),0_0_60px_rgba(23,197,201,.15)] bg-black">
          <video
            className="w-full aspect-video block"
            src={VIDEO_ES}
            poster={VIDEO_POSTER}
            controls
            preload="metadata"
            playsInline
          />
        </div>
        <Link to="/registro" className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-navy-950 bg-primary-400 hover:bg-primary-300 transition-colors">
          Crear mi primera cotización <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

function HeroMockup() {
  const { t } = useTranslation()
  const navIcons = [Home, FileText, Users, Settings]
  // Maqueta decorativa: se oculta a lectores de pantalla y nada en ella es clicable.
  return (
    <div className="relative min-w-0" aria-hidden="true">
      <div className="card p-0 shadow-card-hover flex overflow-hidden">
        <div className="w-12 bg-navy-900 flex flex-col items-center py-4 gap-5 shrink-0">
          <span className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center text-navy-900 text-[10px] font-bold">CG</span>
          {navIcons.map((Ic, i) => (
            <Ic key={i} className={`w-4 h-4 ${i === 0 ? 'text-white' : 'text-navy-300'}`} />
          ))}
        </div>
        <div className="flex-1 min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <p className="text-xs text-slate-500">{t('mock.panel')}</p>
              <p className="font-bold text-navy-900">{t('mock.hi')}</p>
            </div>
            <span className="inline-flex items-center gap-1 bg-navy-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">
              <Plus className="w-3 h-3" /> {t('mock.newQuote')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            <div className="bg-fondo rounded-lg p-2 sm:p-2.5 min-w-0">
              <p className="text-[10px] text-slate-500">{t('mock.folios')}</p>
              <p className="text-[clamp(0.8rem,3.6vw,1.25rem)] font-extrabold text-navy-900 tabular-nums">43</p>
              <p className="text-[10px] text-slate-500">{t('mock.ofFolios')}</p>
            </div>
            <div className="bg-fondo rounded-lg p-2 sm:p-2.5 min-w-0">
              <p className="text-[10px] text-slate-500">{t('mock.month')}</p>
              <p className="text-[clamp(0.8rem,3.6vw,1.25rem)] font-extrabold text-primary-700 tabular-nums">$86,450</p>
              <p className="text-[10px] text-success-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> 12.5%</p>
            </div>
            <div className="bg-fondo rounded-lg p-2 sm:p-2.5 min-w-0">
              <p className="text-[10px] text-slate-500">{t('mock.quotes')}</p>
              <p className="text-[clamp(0.8rem,3.6vw,1.25rem)] font-extrabold text-navy-900 tabular-nums">27</p>
              <p className="text-[10px] text-slate-500">{t('mock.accepted')}</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('mock.recent')}</p>
          <div className="mt-2 space-y-1.5">
            {[['CTZ-0027', 'Grupo Nova', '$12,800'], ['CTZ-0026', 'Café Central', '$4,250'], ['CTZ-0025', 'Punto Digital', '$8,900']].map(r => (
              <div key={r[0]} className="flex items-center justify-between gap-2 bg-fondo rounded-lg px-3 py-2 text-sm">
                <span className="font-mono text-[11px] text-slate-500 truncate min-w-0">{r[0]} · {r[1]}</span>
                <span className="font-semibold text-navy-900">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -right-4 -bottom-8 w-52 card p-4 shadow-card-hover hidden sm:block">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('features.quote')}</p>
        <p className="font-mono text-xs text-slate-500">#CTZ-0027</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-500">{t('mock.total')}</span>
          <span className="font-extrabold text-navy-900">$12,800</span>
        </div>
        <span className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-success-500 text-white text-xs font-semibold rounded-lg py-2 cursor-default select-none">
          <MessageCircle className="w-3.5 h-3.5" /> {t('mock.sendWa')}
        </span>
      </div>

      <div className="absolute -left-4 top-8 bg-white rounded-xl shadow-card-hover border border-slate-100 px-3 py-2 flex items-center gap-2 hidden sm:flex">
        <span className="w-7 h-7 rounded-full bg-success-100 text-success-600 flex items-center justify-center"><Check className="w-4 h-4" /></span>
        <div>
          <p className="text-[11px] font-semibold text-navy-900">{t('mock.sent')}</p>
          <p className="text-[10px] text-slate-500">{t('mock.now')}</p>
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  const { t } = useTranslation()
  const items = [t('ideal.a'), t('ideal.b'), t('ideal.c'), t('ideal.d'), t('ideal.e')]
  const tira = items.map((x, i) => (
    <span key={x + i} className="mx-6 inline-flex items-center gap-2 text-sm font-medium text-navy-700 shrink-0">
      <span className="text-primary-500" aria-hidden="true">✦</span> {x}
    </span>
  ))
  return (
    <div className="border-y border-slate-100 bg-white py-6">
      <p className="text-center text-xs font-semibold tracking-widest text-slate-500 uppercase mb-4">{t('idealFor')}</p>
      <div className="overflow-hidden marquee-mask">
        <div className="flex w-max animate-marquee whitespace-nowrap">
          <div className="flex items-center shrink-0">{tira}{tira}{tira}</div>
          <div className="flex items-center shrink-0" aria-hidden="true">{tira}{tira}{tira}</div>
        </div>
      </div>
    </div>
  )
}

function Features() {
  const { t } = useTranslation()
  const items = [
    { icon: MessageCircle, title: t('features.waTitle'), desc: t('features.waDesc') },
    { icon: Mail, title: t('features.mailTitle'), desc: t('features.mailDesc') },
    { icon: Smartphone, title: t('features.appTitle'), desc: t('features.appDesc') },
    { icon: RefreshCw, title: t('features.trackTitle'), desc: t('features.trackDesc') },
  ]
  return (
    <section id="funciones" className="max-w-6xl mx-auto px-4 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-primary-700 uppercase">{t('features.tag')}</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">{t('features.title')}</h2>
        <p className="mt-4 text-slate-600">{t('features.subtitle')}</p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-5 md:grid-rows-2">
        <div className="card p-6 md:row-span-2 flex flex-col hover:shadow-card-hover transition-shadow group">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-navy-900 transition-colors">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-semibold text-navy-900">{t('features.pdfTitle')}</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{t('features.pdfDesc')}</p>
          <div className="mt-6 flex-1 flex items-end">
            <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{t('features.quote')}</span>
                <span className="font-mono text-[11px] text-slate-500">#0048</span>
              </div>
              <p className="mt-3 font-semibold text-navy-900 text-sm">{t('features.yourCompany')}</p>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 bg-slate-100 rounded w-full" />
                <div className="h-2 bg-slate-100 rounded w-4/5" />
                <div className="h-2 bg-slate-100 rounded w-3/5" />
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('features.total')}</span>
                <span className="font-extrabold text-navy-900">$18,450.00</span>
              </div>
            </div>
          </div>
        </div>
        {items.map(f => (
          <div key={f.title} className="card p-6 hover:shadow-card-hover transition-shadow group">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-navy-900 transition-colors">
              <f.icon className="w-5 h-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-semibold text-navy-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function EnvioInstantaneo() {
  const { t } = useTranslation()
  return (
    <section className="bg-fondo">
      <div className="max-w-6xl mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-700 uppercase">
            <Send className="w-4 h-4" aria-hidden="true" /> {t('envio.tag')}
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">{t('envio.title')}</h2>
          <p className="mt-4 text-slate-600">{t('envio.subtitle')}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1.5" style={{ background: 'rgba(37,211,102,0.12)', color: '#128C3E' }}><MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1.5"><Mail className="w-3.5 h-3.5" aria-hidden="true" /> Email</span>
          </div>
          <ul className="mt-6 space-y-3">
            {[t('envio.b1'), t('envio.b2'), t('envio.b3')].map(b => (
              <li key={b} className="flex items-center gap-3 text-slate-700">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success-50 text-success-600 shrink-0" aria-hidden="true"><Check className="w-3.5 h-3.5" /></span>
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Chat de WhatsApp: ilustración; usa los colores de WhatsApp a propósito. */}
        <div className="mx-auto w-full max-w-sm" aria-hidden="true">
          <div className="rounded-[26px] bg-white shadow-card-hover border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: '#075E54' }}>
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">C</span>
              <div><p className="text-white text-sm font-semibold leading-none">Cliente</p><p className="text-white/70 text-[10px] mt-1">online</p></div>
            </div>
            <div className="px-4 py-5 space-y-3" style={{ background: '#ECE5DD', minHeight: 300 }}>
              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-tr-sm px-3 py-2.5 shadow-sm" style={{ background: '#DCF8C6' }}>
                  <div className="flex items-center gap-2 rounded-lg bg-white/70 px-2.5 py-2">
                    <span className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-navy-900 truncate">{t('envio.chatFile')}.pdf</p>
                      <p className="text-[11px] text-slate-500">$18,450.00 MXN</p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500 text-right flex items-center justify-end gap-1">{t('envio.sent')} <Check className="w-3 h-3" style={{ color: '#34B7F1' }} /></p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 shadow-sm">
                  <p className="text-[13px] text-navy-900">{t('envio.reply')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Steps() {
  const { t } = useTranslation()
  const steps = [
    { num: '01', icon: Pencil, title: t('steps.s1t'), desc: t('steps.s1d') },
    { num: '02', icon: FileText, title: t('steps.s2t'), desc: t('steps.s2d') },
    { num: '03', icon: Send, title: t('steps.s3t'), desc: t('steps.s3d') },
  ]
  return (
    <section id="como-funciona" className="bg-fondo">
      <div className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-primary-700 uppercase">{t('steps.tag')}</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">{t('steps.title')}</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={s.num} className="relative text-center">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-card text-primary-500">
                <s.icon className="w-6 h-6" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-bold text-primary-700">{s.num}</p>
              <h3 className="mt-1 font-semibold text-navy-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
              {i < steps.length - 1 && (
                <ArrowRight aria-hidden="true" className="hidden md:block absolute top-6 -right-4 w-5 h-5 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function AppComingSoon() {
  const { t } = useTranslation()
  return (
    <section className="max-w-6xl mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-700 uppercase">
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary-500" /> {t('soon.tag')}
        </span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-navy-900 leading-tight">{t('soon.title')}</h2>
        <p className="mt-4 text-slate-600 max-w-md">{t('soon.desc')}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <StoreBadge store="App Store" icon={<AppleIcon />} />
          <StoreBadge store="Google Play" icon={<PlayStoreIcon />} />
        </div>
        <p className="mt-4 text-xs text-slate-500">{t('soon.meanwhile')}</p>
      </div>
      <div className="relative flex justify-center py-10" aria-hidden="true">
        <span className="orbit-ring pulse-1 w-[300px] h-[300px] hidden sm:block" />
        <span className="orbit-ring pulse-2 w-[400px] h-[400px] hidden sm:block" />
        <span className="orbit-ring pulse-3 w-[500px] h-[500px] hidden sm:block" />
        <div className="relative z-10 w-[218px] h-[430px] rounded-[34px] border-[7px] border-navy-900 bg-fondo pt-[30px] px-[15px] pb-[50px] animate-phone-float"
             style={{ boxShadow: '0 35px 65px rgba(5,38,61,0.25)' }}>
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-2 rounded-[10px] bg-navy-900" />
          <img src="/cotiza-go-logo-v2.png" alt="" width={640} height={124} className="w-[90px] h-auto" />
          <div className="mt-[21px] mb-3">
            <small className="block text-[7px] tracking-wide uppercase text-slate-500">{t('soon.goodDay')}</small>
            <b className="block mt-0.5 text-base text-navy-900">{t('mock.hi')}</b>
          </div>
          <div className="rounded-[14px] p-4 text-white bg-gradient-to-br from-navy-900 to-primary-600">
            <small className="block text-[7px] tracking-wide uppercase text-primary-200">{t('mock.folios')}</small>
            <strong className="block my-1.5 text-[28px] font-extrabold leading-none">43</strong>
            <span className="block h-1 rounded" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <b className="block h-full rounded bg-primary-400" style={{ width: '86%' }} />
            </span>
            <span className="block mt-1.5 text-[7px] text-primary-100">{t('soon.foliosUsed')}</span>
          </div>
          <div className="mt-[13px] rounded-[11px] bg-white border border-slate-200 p-[13px] text-xs shadow-sm text-primary-600">
            ＋ <b className="ml-1.5 text-[10px] text-navy-700">{t('mock.newQuote')}</b>
          </div>
          <div className="absolute bottom-2.5 left-3.5 right-3.5 rounded-xl bg-white flex justify-around p-2.5 text-slate-400">
            <Home className="w-4 h-4 text-primary-500" /><FileText className="w-4 h-4" /><Users className="w-4 h-4" /><Settings className="w-4 h-4" />
          </div>
        </div>
        <span className="absolute left-2 top-8 z-20 bg-white rounded-xl shadow-card-hover border border-slate-100 px-4 py-2.5 text-center hidden sm:block">
          <span className="block text-sm font-bold text-navy-900">iOS</span>
          <span className="block text-[10px] text-slate-500">{t('soon.comingSoon')}</span>
        </span>
        <span className="absolute right-2 bottom-16 z-20 bg-white rounded-xl shadow-card-hover border border-slate-100 px-4 py-2.5 text-center hidden sm:block">
          <span className="block text-sm font-bold text-navy-900">Android</span>
          <span className="block text-[10px] text-slate-500">{t('soon.comingSoon')}</span>
        </span>
      </div>
    </section>
  )
}

function StoreBadge({ store, icon }: { store: string; icon: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-3 bg-navy-900 text-white rounded-xl px-5 py-2.5 cursor-default select-none">
      {icon}
      <span className="text-left leading-tight">
        <span className="block text-[10px] text-slate-300">{t('soon.onStore')}</span>
        <span className="block text-base font-semibold -mt-0.5">{store}</span>
      </span>
    </span>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.53c-.02-2.02 1.65-2.99 1.73-3.04-.94-1.38-2.4-1.57-2.92-1.59-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.3 2-1.41 2.44-.36 6.05 1.01 8.03.67.97 1.47 2.06 2.52 2.02 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.09-.02 1.78-.99 2.44-1.96.77-1.12 1.09-2.21 1.11-2.27-.02-.01-2.13-.82-2.15-3.24zM15.09 6.6c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.14z"/>
    </svg>
  )
}

function PlayStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
      <path fill="#00D26E" d="M4 3 4 12 13.2 12z" />
      <path fill="#00A0FF" d="M4 12 4 21 13.2 12z" />
      <path fill="#FFCE00" d="M4 3 13.2 12 20.4 12z" />
      <path fill="#FF3B30" d="M4 21 13.2 12 20.4 12z" />
    </svg>
  )
}

function Pricing() {
  const { t, i18n } = useTranslation()
  const { paquetes } = usePaquetes()
  return (
    <section id="paquetes" className="max-w-7xl mx-auto px-4 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-primary-700 uppercase">{t('pricing.tag')}</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">{t('pricing.title')}</h2>
        <p className="mt-4 text-slate-600">{t('pricing.subtitle')}</p>
      </div>
      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {paquetes.map(p => {
          const pr = precioDe(p, i18n.language)
          return (
          <div key={p.id}
            className={`card p-7 relative ${p.popular ? 'ring-2 ring-primary-500 shadow-card-hover md:-mt-4 md:pb-11' : ''}`}>
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-navy-900 text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">{t('pricing.popular')}</span>
            )}
            <h3 className="font-bold text-navy-900 text-lg">{p.nombre}</h3>
            <p className="text-sm text-slate-500">{trPaquete(p.descripcion)}</p>
            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-primary-700">{p.folios}</span>
              <span className="text-slate-500 mb-1">{t('pricing.foliosWord')}</span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">{SIMBOLO_MONEDA[pr.moneda] ?? '$'}{fmtPrecio(pr.precio)} <span className="text-sm font-medium text-slate-500">{pr.moneda}</span></p>
            <Link to={`/registro?plan=${(p.nombre ?? '').toLowerCase()}`}
              className={`mt-5 w-full justify-center ${p.popular ? 'btn-primary' : 'btn-secondary'}`}>
              {t('pricing.choose')}
            </Link>
            <ul className="mt-6 space-y-2.5">
              {(p.beneficios ?? []).map((f: string) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-success-500 shrink-0" aria-hidden="true" /> {trPaquete(f)}
                </li>
              ))}
            </ul>
          </div>
          )
        })}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">{t('pricing.trust')}</p>
    </section>
  )
}

function CtaBand() {
  const { t } = useTranslation()
  return (
    <section className="max-w-6xl mx-auto px-4 pb-24">
      <div className="rounded-3xl px-8 py-14 sm:px-14 bg-gradient-to-br from-navy-900 to-primary-600 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary-200 uppercase">{t('cta.tag')}</p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white max-w-lg">{t('cta.title')}</h2>
          <p className="mt-3 text-primary-100/80">{t('cta.desc')}</p>
        </div>
        <Link to="/registro" className="shrink-0 inline-flex items-center gap-2 bg-white text-navy-900 font-semibold px-6 py-3 rounded-xl hover:bg-primary-50 transition-colors">
          {t('cta.button')} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-slate-500 max-w-xs">{t('footer.tagline')}</p>
        </div>
        <div>
          <p className="font-semibold text-navy-900 text-sm">{t('footer.product')}</p>
          <ul className="mt-3 space-y-2">
            <li><a href="#funciones" className="text-sm text-slate-500 hover:text-primary-700">{t('nav.features')}</a></li>
            <li><a href="#paquetes" className="text-sm text-slate-500 hover:text-primary-700">{t('nav.pricing')}</a></li>
            <li><Link to="/api" className="text-sm text-slate-500 hover:text-primary-700">API para desarrolladores</Link></li>
            <li><Link to="/login" className="text-sm text-slate-500 hover:text-primary-700">{t('nav.login')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-navy-900 text-sm">{t('footer.support')}</p>
          <ul className="mt-3 space-y-2">
            <li><Link to="/ayuda" className="text-sm text-slate-500 hover:text-primary-700">{t('footer.help')}</Link></li>
            <li><Link to="/contacto" className="text-sm text-slate-500 hover:text-primary-700">{t('footer.contact')}</Link></li>
            <li><Link to="/privacidad" className="text-sm text-slate-500 hover:text-primary-700">{t('footer.privacy')}</Link></li>
            <li><Link to="/terminos" className="text-sm text-slate-500 hover:text-primary-700">{t('footer.terms')}</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-navy-900 text-sm">{t('footer.noHassleTitle')}</p>
          <p className="mt-3 text-sm text-slate-500 max-w-xs">{t('footer.noHassle')}</p>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <p className="max-w-6xl mx-auto px-4 py-5 text-xs text-slate-500">{t('footer.rights')}</p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  // Al llegar con ancla (p.ej. /#funciones desde otra página), desplaza a la sección.
  useEffect(() => {
    const id = window.location.hash.replace('#', '')
    if (!id) return
    const el = document.getElementById(id)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  return (
    <div className="bg-white overflow-x-clip">
      <Nav />
      <main id="contenido">
      <Hero />
      <VideoVenta />
      <Marquee />
      <Features />
      <EnvioInstantaneo />
      <Steps />
      <Pricing />
      <AppComingSoon />
      <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
