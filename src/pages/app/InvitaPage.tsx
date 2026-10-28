// Zona de referidos del panel: "Invita y gana".
// Cada usuario tiene su enlace único (?ref=CODIGO). Cuando un invitado hace su
// PRIMER pago de folios, ambos reciben folios de recompensa (lo aplica el
// webhook de Stripe vía la función acreditar_referido).
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Gift, Copy, Check, Users, Coins, Clock, MessageCircle } from 'lucide-react'

const T: Record<string, any> = {
  es: {
    title: 'Invita y gana', subtitle: 'Comparte Cotiza Go y gana folios cuando tus invitados hagan su primera compra.',
    reward: 'Ganas 20 folios por cada persona que invites y haga su primera compra — y tu invitado recibe 10 folios de bienvenida.',
    yourLink: 'Tu enlace de invitación', copy: 'Copiar', copied: '¡Copiado!', shareWa: 'Compartir por WhatsApp',
    waMsg: 'Te comparto Cotiza Go para hacer cotizaciones profesionales y enviarlas por WhatsApp. Regístrate con mi enlace y recibe folios gratis:',
    how: 'Cómo funciona', s1: 'Comparte tu enlace con clientes y colegas.', s2: 'Se registran con tu enlace y prueban gratis.', s3: 'Cuando hacen su primera compra, ambos ganan folios.',
    invited: 'Invitados', bought: 'Ya compraron', earned: 'Folios ganados', pending: 'Pendientes',
    empty: 'Aún no tienes invitados. ¡Comparte tu enlace para empezar a ganar!',
  },
  en: {
    title: 'Invite and earn', subtitle: 'Share Cotiza Go and earn credits when your invitees make their first purchase.',
    reward: 'Earn 20 credits for every person you invite who makes their first purchase — and your invitee gets 10 welcome credits.',
    yourLink: 'Your invite link', copy: 'Copy', copied: 'Copied!', shareWa: 'Share on WhatsApp',
    waMsg: 'I’m sharing Cotiza Go with you — make professional quotes and send them by WhatsApp. Sign up with my link and get free credits:',
    how: 'How it works', s1: 'Share your link with clients and colleagues.', s2: 'They sign up with your link and try it free.', s3: 'When they make their first purchase, you both earn credits.',
    invited: 'Invited', bought: 'Purchased', earned: 'Credits earned', pending: 'Pending',
    empty: 'You have no invitees yet. Share your link to start earning!',
  },
  pt: {
    title: 'Convide e ganhe', subtitle: 'Compartilhe o Cotiza Go e ganhe créditos quando seus convidados fizerem a primeira compra.',
    reward: 'Ganhe 20 créditos por cada pessoa que convidar e fizer a primeira compra — e seu convidado recebe 10 créditos de boas-vindas.',
    yourLink: 'Seu link de convite', copy: 'Copiar', copied: 'Copiado!', shareWa: 'Compartilhar no WhatsApp',
    waMsg: 'Compartilho com você o Cotiza Go — faça orçamentos profissionais e envie por WhatsApp. Cadastre-se com meu link e ganhe créditos grátis:',
    how: 'Como funciona', s1: 'Compartilhe seu link com clientes e colegas.', s2: 'Eles se cadastram com seu link e testam grátis.', s3: 'Quando fazem a primeira compra, ambos ganham créditos.',
    invited: 'Convidados', bought: 'Já compraram', earned: 'Créditos ganhos', pending: 'Pendentes',
    empty: 'Você ainda não tem convidados. Compartilhe seu link para começar a ganhar!',
  },
  fr: {
    title: 'Parrainez et gagnez', subtitle: 'Partagez Cotiza Go et gagnez des crédits quand vos invités font leur premier achat.',
    reward: 'Gagnez 20 crédits pour chaque personne que vous invitez et qui fait son premier achat — et votre invité reçoit 10 crédits de bienvenue.',
    yourLink: 'Votre lien de parrainage', copy: 'Copier', copied: 'Copié !', shareWa: 'Partager sur WhatsApp',
    waMsg: 'Je te partage Cotiza Go — fais des devis professionnels et envoie-les par WhatsApp. Inscris-toi avec mon lien et reçois des crédits gratuits :',
    how: 'Comment ça marche', s1: 'Partagez votre lien avec clients et collègues.', s2: 'Ils s’inscrivent avec votre lien et testent gratuitement.', s3: 'Quand ils font leur premier achat, vous gagnez tous les deux des crédits.',
    invited: 'Invités', bought: 'Ont acheté', earned: 'Crédits gagnés', pending: 'En attente',
    empty: 'Vous n’avez pas encore d’invités. Partagez votre lien pour commencer à gagner !',
  },
}

export default function InvitaPage() {
  const { i18n } = useTranslation()
  const c = T[i18n.language] ?? T.es
  const { user } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [refs, setRefs] = useState<any[]>([])
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('codigo_ref').eq('id', user.id).maybeSingle()
      .then(({ data }) => setCodigo(data?.codigo_ref ?? ''))
    supabase.from('referidos').select('estado, folios_referrer, created_at, acreditado_at').eq('referrer_id', user.id)
      .then(({ data }) => setRefs(data ?? []))
  }, [user])

  const enlace = codigo ? `${window.location.origin}/registro?ref=${codigo}` : ''
  const acreditados = refs.filter(r => r.estado === 'acreditado')
  const pendientes = refs.filter(r => r.estado !== 'acreditado')
  const foliosGanados = acreditados.reduce((s, r) => s + (r.folios_referrer || 0), 0)

  const copiar = () => {
    if (!enlace) return
    navigator.clipboard.writeText(enlace).then(() => {
      setCopiado(true); toast.success(c.copied); setTimeout(() => setCopiado(false), 2000)
    }).catch(() => toast.error('No se pudo copiar'))
  }
  const compartirWa = () => {
    if (!enlace) return
    window.open(`https://wa.me/?text=${encodeURIComponent(c.waMsg + ' ' + enlace)}`, '_blank')
  }

  const stat = (icon: any, label: string, value: string | number, color: string) => {
    const Icon = icon
    return (
      <div className="card p-4 flex items-center gap-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon className="w-5 h-5" aria-hidden="true" /></span>
        <div><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold text-navy-900">{value}</p></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-primary-600 text-navy-900 flex items-center justify-center"><Gift className="w-5 h-5" aria-hidden="true" /></span>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{c.title}</h1>
          <p className="text-slate-500 text-sm">{c.subtitle}</p>
        </div>
      </div>

      <div className="card p-5 bg-primary-50/50 border-primary-100">
        <p className="text-sm text-navy-900">{c.reward}</p>
      </div>

      {/* Enlace */}
      <div className="card p-5">
        <label htmlFor="inv-enlace" className="label">{c.yourLink}</label>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input id="inv-enlace" readOnly value={enlace} className="input flex-1 font-mono text-xs" onFocus={e => e.currentTarget.select()} />
          <button onClick={copiar} className="btn-secondary shrink-0">
            {copiado ? <Check className="w-4 h-4 text-success-500" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />} {copiado ? c.copied : c.copy}
          </button>
          <button onClick={compartirWa} className="btn-primary shrink-0" style={{ background: '#25D366', borderColor: '#25D366' }}>
            <MessageCircle className="w-4 h-4" aria-hidden="true" /> {c.shareWa}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stat(Users, c.invited, refs.length, 'bg-primary-50 text-primary-700')}
        {stat(Check, c.bought, acreditados.length, 'bg-success-50 text-success-700')}
        {stat(Coins, c.earned, foliosGanados, 'bg-amber-50 text-amber-700')}
        {stat(Clock, c.pending, pendientes.length, 'bg-slate-100 text-slate-500')}
      </div>

      {/* Cómo funciona */}
      <div className="card p-5">
        <h2 className="font-semibold text-navy-900 mb-3">{c.how}</h2>
        <ol className="space-y-2.5">
          {[c.s1, c.s2, c.s3].map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {refs.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-2">{c.empty}</p>
      )}
    </div>
  )
}
