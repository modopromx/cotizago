import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, CheckCircle, Zap, Users, BarChart3, Shield, Globe2,
  ArrowRight, Star, Menu, X, ChevronDown, MessageCircle,
  Clock, CreditCard, Send, Eye, TrendingUp, Smartphone,
  Award, Play, Download, Check, Building2
} from 'lucide-react'

// ─── DATOS ────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Características', href: '#features' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Precios', href: '#precios' },
  { label: 'Testimonios', href: '#testimonios' },
]

const STATS = [
  { value: '12,500+', label: 'Cotizaciones enviadas' },
  { value: '3,200+', label: 'Empresas activas' },
  { value: '98%', label: 'Tasa de entrega' },
  { value: '4.2 min', label: 'Tiempo promedio de creación' },
]

const FEATURES = [
  {
    icon: FileText,
    title: 'Cotizaciones en 1 minuto',
    desc: 'Crea cotizaciones profesionales con tu logo, colores y datos en menos de 60 segundos. Sin hojas de cálculo, sin Word.',
    color: 'text-primary-400',
    bg: 'bg-primary-500/10',
  },
  {
    icon: Eye,
    title: 'Seguimiento en tiempo real',
    desc: 'Sabe exactamente cuándo tu cliente abrió la cotización, cuántas veces la vio y desde qué país. Nunca más el "no me llegó".',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: CreditCard,
    title: 'Cobro en línea integrado',
    desc: 'Agrega un botón de pago directamente en tu cotización. Tu cliente paga con tarjeta o transferencia sin salir del documento.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Users,
    title: 'Gestión de clientes',
    desc: 'Catálogo completo de clientes con su historial de cotizaciones, datos fiscales y contacto en un solo lugar.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Globe2,
    title: 'Multimoneda LATAM',
    desc: 'MXN, USD, COP, ARS, CLP y más. Precios con IVA o sin IVA según el país de tu cliente, automáticamente.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Download,
    title: 'Descarga en PDF',
    desc: 'Descarga cualquier cotización en PDF listo para imprimir o adjuntar en email con tu marca perfectamente aplicada.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
]

const STEPS = [
  { num: '01', title: 'Crea la cotización', desc: 'Selecciona tu cliente, agrega los conceptos desde tu catálogo y personaliza los términos. Todo en un formulario limpio.', icon: FileText },
  { num: '02', title: 'Envía al cliente', desc: 'Comparte el link único por WhatsApp, email o donde prefieras. Se ve perfecto en celular y computadora.', icon: Send },
  { num: '03', title: 'Rastrea y analiza', desc: 'Recibe notificación cuando tu cliente abre el link. Ve cuántas veces lo revisó y desde dónde.', icon: Eye },
  { num: '04', title: 'Cierra el trato', desc: 'Tu cliente acepta o rechaza directo en el link. Si acepta, puede pagar al instante con tarjeta o transferencia.', icon: CheckCircle },
]

const PLANES = [
  {
    nombre: 'Pack 100',
    folios: 100,
    precio: 149,
    por_folio: '1.49',
    moneda: 'MXN',
    desc: 'Ideal para freelancers y negocios que arrancan',
    features: ['100 cotizaciones enviadas', 'Link de seguimiento', 'PDF descargable', 'Soporte por email', 'Historial 6 meses'],
    popular: false,
    cta: 'Empezar con 100 folios',
    priceId: 'price_pack100',
  },
  {
    nombre: 'Pack 300',
    folios: 300,
    precio: 349,
    por_folio: '1.16',
    moneda: 'MXN',
    desc: 'El favorito de agencias y PYMES en crecimiento',
    features: ['300 cotizaciones enviadas', 'Link de seguimiento', 'Cobro en línea integrado', 'Soporte prioritario', 'Historial completo', 'Multi-usuario próx.'],
    popular: true,
    cta: 'Empezar con 300 folios',
    priceId: 'price_pack300',
  },
  {
    nombre: 'Pack 800',
    folios: 800,
    precio: 599,
    por_folio: '0.75',
    moneda: 'MXN',
    desc: 'Para equipos de ventas con alto volumen',
    features: ['800 cotizaciones enviadas', 'Link de seguimiento', 'Cobro en línea integrado', 'Soporte VIP WhatsApp', 'Historial completo', 'Estadísticas avanzadas', 'Multi-usuario próx.'],
    popular: false,
    cta: 'Empezar con 800 folios',
    priceId: 'price_pack800',
  },
]

const TESTIMONIOS = [
  { nombre: 'Carlos Rodríguez', cargo: 'Agencia de Diseño', pais: '🇲🇽 México', stars: 5, texto: 'Antes tardaba 30 minutos en armar una cotización en Word. Ahora lo hago en 2 minutos y se ve 10 veces más profesional. Mis clientes preguntan con qué herramienta lo hago.' },
  { nombre: 'María González', cargo: 'Consultora Independiente', pais: '🇨🇴 Colombia', stars: 5, texto: 'El seguimiento es una joya. Sé exactamente cuándo mi cliente abrió la cotización y cuántas veces la revisó. Eso me da el momento perfecto para hacer el seguimiento.' },
  { nombre: 'Roberto Martínez', cargo: 'Impresora Digital', pais: '🇲🇽 México', stars: 5, texto: 'Desde que activé el cobro en línea, el 40% de mis clientes pagan el mismo día que reciben la cotización. Antes esperaba semanas por una transferencia.' },
  { nombre: 'Ana Jiménez', cargo: 'Agencia de Marketing', pais: '🇲🇽 México', stars: 5, texto: 'Migré todo mi equipo de ventas a CotizaGo en un día. La curva de aprendizaje es casi cero y el soporte responde rápidísimo.' },
  { nombre: 'Luis Herrera', cargo: 'Constructor Civil', pais: '🇨🇱 Chile', stars: 5, texto: 'Manejo cotizaciones en USD y CLP sin problema. La multimoneda funciona perfecto y los PDFs salen impecables para mis clientes corporativos.' },
  { nombre: 'Patricia Sánchez', cargo: 'Fotógrafa Comercial', pais: '🇲🇽 México', stars: 5, texto: 'Elegante, rápido y mis clientes lo perciben muy profesional. Definitivamente la mejor inversión para mi negocio este año.' },
]

// ─── COMPONENTES ──────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-navy-950/95 backdrop-blur-md border-b border-white/5 shadow-xl' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/30">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">CotizaGo</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-slate-300 hover:text-white transition-colors">{l.label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-2">Iniciar sesión</Link>
          <Link to="/registro" className="btn-primary text-sm py-2 px-4 shadow-lg shadow-primary-600/30">
            Crear cuenta gratis <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-slate-300 hover:text-white">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-navy-950/98 backdrop-blur-md border-t border-white/5 px-4 py-4 space-y-4">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-slate-300 hover:text-white py-2">{l.label}</a>
          ))}
          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <Link to="/login" className="btn-secondary justify-center text-sm">Iniciar sesión</Link>
            <Link to="/registro" className="btn-primary justify-center text-sm">Crear cuenta gratis</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-navy-950 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-navy-700/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage:'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize:'60px 60px'}} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3 h-3" />
              Plataforma #1 de cotizaciones para LATAM
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-6">
              Cotizaciones<br />
              <span className="bg-gradient-to-r from-primary-400 to-emerald-400 bg-clip-text text-transparent">profesionales</span><br />
              para tu negocio
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
              Crea, envía y da seguimiento a cotizaciones en minutos. Multimoneda, diseñado para latinoamérica. Tu cliente acepta y paga en el mismo link.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link to="/registro" className="btn-primary text-base py-3 px-6 shadow-xl shadow-primary-600/25 justify-center">
                Empezar gratis <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#como-funciona" className="btn-secondary text-base py-3 px-6 justify-center bg-white/5 border-white/10 text-white hover:bg-white/10">
                <Play className="w-4 h-4 text-primary-400" /> Ver cómo funciona
              </a>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex -space-x-2">
                {['C','M','R','A','L'].map((l, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-navy-950 flex items-center justify-center text-xs font-bold text-white" style={{backgroundColor: ['#1e7363','#305395','#7e22ce','#b45309','#be185d'][i]}}>
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-400 text-xs mt-0.5">+3,200 empresas confían en CotizaGo</p>
              </div>
            </div>
          </div>

          {/* Right - Mockup cotización */}
          <div className="hidden lg:block relative">
            <div className="relative">
              {/* Glow */}
              <div className="absolute inset-0 bg-primary-500/10 rounded-3xl blur-2xl scale-110" />

              {/* Card principal */}
              <div className="relative bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                {/* Header cotización */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-white font-bold text-lg">Mi Empresa SA</p>
                    <p className="text-slate-400 text-xs">contacto@miempresa.com</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs mb-1">Cotización</p>
                    <p className="text-primary-400 font-mono font-bold">#COT-2026-0042</p>
                    <div className="inline-flex items-center gap-1 mt-2 bg-emerald-500/15 text-emerald-400 text-xs px-2 py-0.5 rounded-full">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      Vista hace 2 min
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2 mb-5">
                  {[
                    { nombre: 'Diseño de branding corporativo', precio: '$18,000' },
                    { nombre: 'Desarrollo web (5 páginas)', precio: '$24,000' },
                    { nombre: 'Estrategia de contenidos (3 meses)', precio: '$13,200' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                      <p className="text-slate-300 text-sm">{item.nombre}</p>
                      <p className="text-white font-semibold text-sm">{item.precio}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-5">
                  <div className="text-slate-400 text-sm">Total con IVA</div>
                  <div className="text-2xl font-bold text-white">$55,200 <span className="text-slate-400 text-sm font-normal">MXN</span></div>
                </div>

                {/* CTA buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button className="py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors">
                    <CheckCircle className="w-4 h-4" /> Aceptar
                  </button>
                  <button className="py-2.5 bg-white/5 border border-white/10 text-slate-300 text-sm font-medium rounded-xl flex items-center justify-center gap-1.5">
                    <CreditCard className="w-4 h-4" /> Pagar ahora
                  </button>
                </div>
              </div>

              {/* Badge flotante - seguimiento */}
              <div className="absolute -top-4 -right-4 bg-navy-800 border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-white text-xs font-semibold">Cliente la abrió</p>
                    <p className="text-slate-400 text-xs">3 veces · desde CDMX</p>
                  </div>
                </div>
              </div>

              {/* Badge flotante - pago */}
              <div className="absolute -bottom-4 -left-4 bg-navy-800 border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-emerald-400 text-xs font-semibold">¡Pago recibido! $55,200 MXN</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-6 pt-16 border-t border-white/5">
          {STATS.map(s => (
            <div key={s.value} className="text-center">
              <p className="text-3xl font-bold text-white mb-1">{s.value}</p>
              <p className="text-slate-500 text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            CARACTERÍSTICAS
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Todo lo que necesitas<br />para cotizar y cobrar</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Una plataforma completa que sustituye las hojas de cálculo, el Word y los correos perdidos. Diseñada para vendedores latinoamericanos.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
              <div className={`w-12 h-12 ${f.bg} rounded-xl flex items-center justify-center mb-4`}>
                <f.icon className={`w-6 h-6 ${f.color}`} />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ComoFunciona() {
  return (
    <section id="como-funciona" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-navy-50 text-navy-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            CÓMO FUNCIONA
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Del primer contacto al cierre<br />en 4 pasos</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Sin capacitaciones largas. Tus vendedores envían su primera cotización en menos de 5 minutos.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 relative">
          {/* Línea conectora */}
          <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200" />

          {STEPS.map((s, i) => (
            <div key={s.num} className="relative text-center">
              <div className="relative inline-flex">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary-500/25">
                  <s.icon className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 bg-white border-2 border-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-primary-600">{i + 1}</span>
                </div>
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Precios() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCompra = async (plan: typeof PLANES[0]) => {
    setLoading(plan.priceId)
    // Redirigir a registro con plan seleccionado
    window.location.href = `/registro?plan=${plan.priceId}&folios=${plan.folios}&nombre=${encodeURIComponent(plan.nombre)}&precio=${plan.precio}`
  }

  return (
    <section id="precios" className="py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            PRECIOS
          </div>
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Sin mensualidades.<br />Solo pagas lo que usas.</h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">Compra folios según tu volumen. Cada folio = 1 cotización enviada. Sin contratos, sin sorpresas.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANES.map(plan => (
            <div key={plan.nombre} className={`relative rounded-2xl p-8 border-2 transition-all ${plan.popular ? 'border-primary-500 bg-gradient-to-b from-primary-50 to-white shadow-2xl shadow-primary-100 scale-105' : 'border-slate-200 bg-white hover:border-primary-200 hover:shadow-lg'}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <Star className="w-3 h-3 fill-white" /> MÁS POPULAR
                </div>
              )}

              <div className="mb-6">
                <p className="font-bold text-slate-900 text-lg mb-1">{plan.nombre}</p>
                <p className="text-slate-500 text-sm mb-5">{plan.desc}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-slate-500 text-sm">$</span>
                  <span className="text-5xl font-black text-slate-900">{plan.precio}</span>
                  <span className="text-slate-500 text-sm mb-2">MXN</span>
                </div>
                <p className="text-xs text-slate-400">${plan.por_folio} MXN por cotización • {plan.folios} folios</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary-600" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCompra(plan)}
                disabled={loading === plan.priceId}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${plan.popular ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/30' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
              >
                {loading === plan.priceId ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {plan.cta} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 space-y-2">
          <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-primary-600" />
            Pago seguro con Stripe · Tarjeta o transferencia
          </p>
          <p className="text-sm text-slate-500">
            ¿Necesitas más de 800 folios al mes? <a href="https://wa.me/521234567890" className="text-primary-600 hover:underline font-medium">Contacta ventas →</a>
          </p>
        </div>
      </div>
    </section>
  )
}

function Testimonios() {
  return (
    <section id="testimonios" className="py-24 bg-navy-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/5 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            TESTIMONIOS
          </div>
          <h2 className="text-4xl font-bold text-white mb-4">Lo que dicen nuestros clientes</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">Más de 3,200 empresas en LATAM usan CotizaGo para vender más rápido y cobrar más fácil.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIOS.map((t, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition-colors">
              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-5">"{t.texto}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-navy-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{t.nombre[0]}</span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{t.nombre}</p>
                  <p className="text-slate-400 text-xs">{t.cargo} · {t.pais}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary-600 via-primary-700 to-navy-800 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage:'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize:'60px 60px'}} />
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-400/10 rounded-full blur-3xl" />

      <div className="relative max-w-4xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3 h-3" /> Lleva tu negocio al siguiente nivel
        </div>
        <h2 className="text-5xl font-black text-white mb-6 leading-tight">
          Empieza a cotizar<br />profesionalmente hoy
        </h2>
        <p className="text-primary-100 text-lg mb-10 max-w-2xl mx-auto">
          Desde $149 MXN. Sin mensualidad. Sin contrato. Crea tu cuenta en 30 segundos y envía tu primera cotización en minutos.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/registro" className="inline-flex items-center justify-center gap-2 bg-white text-primary-700 font-bold text-base py-4 px-8 rounded-xl hover:bg-primary-50 transition-colors shadow-2xl">
            Crear cuenta gratis <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="https://wa.me/521234567890" className="inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/20 font-semibold text-base py-4 px-8 rounded-xl hover:bg-white/20 transition-colors">
            <MessageCircle className="w-5 h-5" /> Hablar con ventas
          </a>
        </div>
        <div className="flex items-center justify-center gap-8 mt-10 text-primary-200 text-sm">
          <div className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Sin tarjeta para registrarte</div>
          <div className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Configuración en minutos</div>
          <div className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Soporte en español</div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-white/5 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg">CotizaGo</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-5">
              La plataforma de cotizaciones más rápida para negocios en Latinoamérica. Profesional, multimoneda y con seguimiento en tiempo real.
            </p>
            <a href="https://wa.me/521234567890" className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300">
              <MessageCircle className="w-4 h-4" /> +52 123 456 7890
            </a>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Producto</p>
            <ul className="space-y-2.5">
              {['Características', 'Precios', 'Cómo funciona', 'Testimonios'].map(l => (
                <li key={l}><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-4">Legal</p>
            <ul className="space-y-2.5">
              {['Términos de uso', 'Política de privacidad', 'Aviso legal', 'GDPR'].map(l => (
                <li key={l}><a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
          <p className="text-slate-500 text-sm">© 2026 CotizaGo. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4 text-slate-500 text-xs">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Pagos seguros con Stripe</span>
            <span className="flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> Disponible en LATAM</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <ComoFunciona />
      <Precios />
      <Testimonios />
      <CTA />
      <Footer />
    </div>
  )
}
