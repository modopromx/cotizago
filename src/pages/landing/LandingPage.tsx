import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, MessageCircle, Mail, Smartphone, RefreshCw,
  ArrowRight, Play, Check, Pencil, Send, Menu, X,
} from 'lucide-react'
import Logo from '../../components/Logo'

// ─── DATOS ────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Funciones', href: '#funciones' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Paquetes', href: '#paquetes' },
]

const IDEAL_PARA = ['Freelancers', 'Servicios', 'Comercios', 'Agencias', 'Profesionales']

const FEATURES = [
  { tag: 'PDF', icon: FileText, title: 'PDF profesional en segundos',
    desc: 'Agrega tu logotipo, productos, impuestos, descuentos y condiciones. Nosotros hacemos que se vea impecable.' },
  { tag: 'WA', icon: MessageCircle, title: 'Envía por WhatsApp',
    desc: 'Comparte la cotización con tu cliente sin descargar archivos ni cambiar de aplicación.' },
  { tag: '@', icon: Mail, title: 'Envío por email',
    desc: 'Personaliza el mensaje y envía el PDF directamente al correo de tu prospecto.' },
  { tag: 'PWA', icon: Smartphone, title: 'Funciona como app',
    desc: 'Instálala en tu celular. No necesitas descargarla desde ninguna tienda.' },
  { tag: '↻', icon: RefreshCw, title: 'Control y seguimiento',
    desc: 'Consulta, duplica, edita o cancela cotizaciones desde un solo lugar.' },
]

const STEPS = [
  { num: '01', icon: Pencil, title: 'Captura los datos', desc: 'Selecciona tu cliente, agrega conceptos, precios e impuestos.' },
  { num: '02', icon: FileText, title: 'Genera tu PDF', desc: 'Obtén un documento profesional con tu identidad de marca.' },
  { num: '03', icon: Send, title: 'Envía y da seguimiento', desc: 'Compártelo por WhatsApp o email en un solo toque.' },
]

const PLANES = [
  { nombre: 'Emprende', folios: 25, precio: 199, desc: 'Para comenzar a cotizar',
    features: ['PDFs personalizados', 'WhatsApp y email', 'Sin fecha de caducidad'], popular: false },
  { nombre: 'Negocio', folios: 100, precio: 499, desc: 'Para ventas constantes',
    features: ['Todo lo de Emprende', 'Ahorro por cotización', 'Soporte prioritario'], popular: true },
  { nombre: 'Pro', folios: 300, precio: 999, desc: 'Para equipos de alto volumen',
    features: ['Todo lo de Negocio', 'Mejor precio por folio', 'Uso multiusuario'], popular: false },
]

// ─── COMPONENTES ──────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-navy-700 hover:text-primary-500 transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-navy-700 hover:text-primary-500 transition-colors">Iniciar sesión</Link>
          <Link to="/registro" className="btn-navy">Comenzar ahora</Link>
        </div>
        <button className="md:hidden text-navy-900" onClick={() => setOpen(o => !o)} aria-label="Menú">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-3">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-sm font-medium text-navy-700">{l.label}</a>
          ))}
          <Link to="/login" className="block text-sm font-medium text-navy-700">Iniciar sesión</Link>
          <Link to="/registro" className="btn-navy w-full justify-center">Comenzar ahora</Link>
        </div>
      )}
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute -right-32 top-10 w-96 h-96 rounded-full bg-primary-100/50 blur-3xl -z-10" />
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-600 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" /> Cotizaciones desde cualquier lugar
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-navy-900 leading-[1.1]">
            Cotiza, envía y<br /><span className="text-primary-500">vende más.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-md">
            Crea cotizaciones profesionales en PDF desde tu celular o computadora. Envíalas al instante por WhatsApp o email y convierte oportunidades en ventas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/registro" className="btn-navy px-6 py-3 text-base justify-center">
              Crear mi primera cotización <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#como-funciona" className="btn-secondary px-6 py-3 text-base justify-center">
              <Play className="w-4 h-4" /> Ver cómo funciona
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {['Sin mensualidades', 'Acceso inmediato', 'PWA instalable'].map(t => (
              <span key={t} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <Check className="w-4 h-4 text-success-500" /> {t}
              </span>
            ))}
          </div>
        </div>
        <HeroMockup />
      </div>
    </section>
  )
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="card p-5 shadow-card-hover">
        <div className="flex items-center justify-between mb-4">
          <Logo className="scale-90 origin-left" />
          <span className="w-8 h-8 rounded-full bg-navy-900 text-white text-xs font-bold flex items-center justify-center">AV</span>
        </div>
        <div className="rounded-xl bg-fondo p-4">
          <p className="text-sm text-slate-500">Panel principal</p>
          <p className="font-bold text-navy-900">Hola, Alan 👋</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-400">Folios disponibles</p>
              <p className="text-2xl font-extrabold text-navy-900">43</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-400">Cotizado este mes</p>
              <p className="text-2xl font-extrabold text-primary-600">$86,450</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cotizaciones recientes</p>
          <div className="mt-2 space-y-1.5">
            {[['CTZ-0027', 'Grupo Nova', '$12,800'], ['CTZ-0026', 'Café Central', '$4,250'], ['CTZ-0025', 'Punto Digital', '$8,900']].map(r => (
              <div key={r[0]} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100 text-sm">
                <span className="font-mono text-xs text-slate-500">{r[0]}</span>
                <span className="text-slate-600">{r[1]}</span>
                <span className="font-semibold text-navy-900">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-card-hover border border-slate-100 px-4 py-3 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-success-100 text-success-600 flex items-center justify-center"><Check className="w-4 h-4" /></span>
        <div>
          <p className="text-xs font-semibold text-navy-900">Cotización enviada</p>
          <p className="text-[11px] text-slate-400">WhatsApp · Ahora</p>
        </div>
      </div>
    </div>
  )
}

function Marquee() {
  // Una "tira" con la etiqueta + los items; se repite 4 veces dentro de un track
  // del doble de ancho. Al desplazar el track -50% en loop, el corte es invisible.
  const Tira = () => (
    <>
      <span className="mx-8 text-xs font-semibold tracking-widest text-slate-400 uppercase shrink-0">Ideal para</span>
      {IDEAL_PARA.map((t, i) => (
        <span key={t + i} className="mx-6 inline-flex items-center gap-2 text-sm font-medium text-navy-700 shrink-0">
          <span className="text-primary-400">✦</span> {t}
        </span>
      ))}
    </>
  )
  return (
    <div className="border-y border-slate-100 bg-white overflow-hidden py-4 marquee-mask">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {/* dos mitades idénticas: el track mide 200%, la animación recorre -50% */}
        <div className="flex items-center shrink-0"><Tira /><Tira /></div>
        <div className="flex items-center shrink-0" aria-hidden="true"><Tira /><Tira /></div>
      </div>
    </div>
  )
}

function AppComingSoon() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-primary-600 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" /> Próximamente
        </span>
        <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold text-navy-900 leading-tight">
          Cotiza Go también estará en tu bolsillo.
        </h2>
        <p className="mt-4 text-slate-600 max-w-md">
          Muy pronto podrás descargar la aplicación nativa y crear cotizaciones desde cualquier lugar, con una experiencia optimizada para tu celular.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <StoreBadge store="App Store" icon={<AppleIcon />} />
          <StoreBadge store="Google Play" icon={<PlayStoreIcon />} />
        </div>
        <p className="mt-4 text-xs text-slate-400">Mientras tanto, puedes instalar Cotiza Go como PWA desde tu navegador.</p>
      </div>
      <div className="relative flex justify-center">
        <div className="absolute inset-0 bg-primary-100/40 blur-3xl rounded-full -z-10" />
        <div className="w-56 rounded-[2rem] border-8 border-navy-900 bg-white shadow-card-hover overflow-hidden">
          <div className="bg-navy-900 h-6" />
          <div className="p-4">
            <Logo className="scale-90 origin-left" />
            <div className="mt-4 rounded-xl bg-fondo p-3">
              <p className="text-[11px] text-slate-500">Panel principal</p>
              <p className="text-sm font-bold text-navy-900">Hola, Alan 👋</p>
              <div className="mt-3 bg-white rounded-lg p-3 border border-slate-100">
                <p className="text-[10px] text-slate-400">Folios disponibles</p>
                <p className="text-2xl font-extrabold text-primary-600">43</p>
              </div>
              <button className="mt-3 w-full text-xs font-semibold text-white bg-navy-900 rounded-lg py-2">+ Nueva cotización</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function StoreBadge({ store, icon }: { store: string; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 bg-navy-900 text-white rounded-xl px-5 py-2.5 opacity-90 cursor-default select-none">
      {icon}
      <span className="text-left leading-tight">
        <span className="block text-[10px] text-slate-300">Próximamente en</span>
        <span className="block text-sm font-semibold">{store}</span>
      </span>
    </span>
  )
}

function AppleIcon() {
  return <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M16.365 1.43c0 1.14-.416 2.2-1.11 2.99-.75.86-1.98 1.53-3.12 1.44-.14-1.12.42-2.28 1.09-3.02.75-.85 2.06-1.5 3.14-1.41zM20.5 17.02c-.6 1.4-.9 2.02-1.68 3.26-1.08 1.74-2.6 3.9-4.49 3.92-1.67.01-2.1-1.1-4.37-1.08-2.27.01-2.74 1.1-4.42 1.09-1.89-.02-3.33-1.97-4.41-3.7C-.7 16.2-1.02 10.9 1.28 8.06c1.15-1.44 2.96-2.35 4.63-2.35 1.7 0 2.77 1.1 4.18 1.1 1.36 0 2.19-1.1 4.16-1.1 1.48 0 3.05.81 4.17 2.2-3.66 2-3.07 7.22.08 9.11z"/></svg>
}
function PlayStoreIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M3.6 2.3c-.3.3-.5.7-.5 1.2v17c0 .5.2.9.5 1.2l.1.1L13 12.6v-.2L3.7 2.2l-.1.1zm11 8.3l-2.5 2.5L4 21.9c.4.2.9.2 1.4-.1l9.2-5.2-1-1-.9-1zm3.2-3.6l-2.5 1.4-2.7 2.7 2.7 2.7 2.5 1.4c.9-.5.9-1.9 0-2.4l.3-3.4-.3-2z"/></svg>
}

function Features() {
  return (
    <section id="funciones" className="max-w-6xl mx-auto px-4 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-primary-600 uppercase">Todo lo que necesitas</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">Cotizar nunca fue tan fácil</h2>
        <p className="mt-4 text-slate-600">Olvídate de formatos complicados. Cotiza Go te ayuda a verte profesional y responder antes que tu competencia.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-5">
        {FEATURES.map(f => (
          <div key={f.title} className="card p-6 hover:shadow-card-hover transition-shadow group">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-white transition-colors">
              <f.icon className="w-5 h-5" />
            </span>
            <h3 className="mt-4 font-semibold text-navy-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Steps() {
  return (
    <section id="como-funciona" className="bg-fondo">
      <div className="max-w-6xl mx-auto px-4 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-primary-600 uppercase">Rápido y simple</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">De cero a cotización en 3 pasos</h2>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="relative text-center">
              <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-card text-primary-500">
                <s.icon className="w-6 h-6" />
              </span>
              <p className="mt-4 text-xs font-bold text-primary-500">{s.num}</p>
              <h3 className="mt-1 font-semibold text-navy-900">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-6 -right-4 w-5 h-5 text-slate-300" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="paquetes" className="max-w-6xl mx-auto px-4 py-24">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-primary-600 uppercase">Paga solo por lo que usas</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-navy-900">Elige tu paquete de folios</h2>
        <p className="mt-4 text-slate-600">Sin rentas mensuales ni contratos. Tus folios no caducan.</p>
      </div>
      <div className="mt-14 grid md:grid-cols-3 gap-6 items-start">
        {PLANES.map(p => (
          <div key={p.nombre}
            className={`card p-7 relative ${p.popular ? 'ring-2 ring-primary-500 shadow-card-hover md:-mt-4 md:pb-11' : ''}`}>
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">Más elegido</span>
            )}
            <h3 className="font-bold text-navy-900 text-lg">{p.nombre}</h3>
            <p className="text-sm text-slate-500">{p.desc}</p>
            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-primary-600">{p.folios}</span>
              <span className="text-slate-500 mb-1">folios</span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-navy-900">${p.precio} <span className="text-sm font-medium text-slate-400">MXN</span></p>
            <Link to={`/registro?plan=${p.nombre.toLowerCase()}`}
              className={`mt-5 w-full justify-center ${p.popular ? 'btn-primary' : 'btn-secondary'}`}>
              Elegir paquete
            </Link>
            <ul className="mt-6 space-y-2.5">
              {p.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-success-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-slate-400">Pago seguro · Activación inmediata · Folios acumulables</p>
    </section>
  )
}

function CtaBand() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-24">
      <div className="rounded-3xl px-8 py-14 sm:px-14 bg-gradient-to-br from-navy-900 to-primary-600 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary-200 uppercase">Empieza hoy</p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-white max-w-lg">Una cotización rápida puede ser tu próxima venta.</h2>
          <p className="mt-3 text-primary-100/80">Crea tu cuenta, elige tus folios y empieza a cotizar profesionalmente.</p>
        </div>
        <Link to="/registro" className="shrink-0 inline-flex items-center gap-2 bg-white text-navy-900 font-semibold px-6 py-3 rounded-xl hover:bg-primary-50 transition-colors">
          Crear mi cuenta gratis <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    { title: 'Producto', links: ['Funciones', 'Paquetes', 'Iniciar sesión'] },
    { title: 'Soporte', links: ['Centro de ayuda', 'Contacto', 'Privacidad'] },
  ]
  return (
    <footer className="bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 text-sm text-slate-500 max-w-xs">Cotizaciones profesionales, estés donde estés.</p>
        </div>
        {cols.map(c => (
          <div key={c.title}>
            <p className="font-semibold text-navy-900 text-sm">{c.title}</p>
            <ul className="mt-3 space-y-2">
              {c.links.map(l => <li key={l} className="text-sm text-slate-500 hover:text-primary-500 cursor-pointer">{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100">
        <p className="max-w-6xl mx-auto px-4 py-5 text-xs text-slate-400">© 2026 Cotiza Go. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      <Nav />
      <Hero />
      <Marquee />
      <Features />
      <Steps />
      <AppComingSoon />
      <Pricing />
      <CtaBand />
      <Footer />
    </div>
  )
}
