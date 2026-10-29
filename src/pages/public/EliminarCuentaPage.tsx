// Eliminar la cuenta de Cotiza Go (requisito de Google Play: una página web y una
// forma dentro de la app para pedir que se borre la cuenta y sus datos).
// (29-oct-2026) Pública: explica el proceso. Con sesión iniciada (también dentro
// de la app de Android) muestra el botón que abre la solicitud como ticket de
// Soporte, para que el equipo la atienda desde el panel de admin.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import NavPublica from '../../components/NavPublica'
import toast from 'react-hot-toast'
import { UserX, CheckCircle2 } from 'lucide-react'

const T: Record<string, any> = {
  es: {
    title: 'Eliminar tu cuenta de Cotiza Go',
    intro: 'Puedes pedir en cualquier momento que borremos tu cuenta de Cotiza Go y los datos asociados a ella.',
    comoT: 'Cómo pedirlo',
    como1: 'Entra a tu cuenta (en la web o en la app) y usa el botón «Solicitar eliminación de mi cuenta» de esta página.',
    como2: 'O escríbenos a contacto@cotizago.com.mx desde el correo con el que te registraste, con el asunto «Eliminar mi cuenta».',
    borraT: 'Qué se borra',
    borra: 'Tu usuario y acceso, los datos de tu empresa, tus clientes, productos, cotizaciones, plantillas, integraciones (llaves y contraseñas guardadas) y los archivos que subiste (logo, adjuntos).',
    guardaT: 'Qué se conserva',
    guarda: 'Los registros de pagos y las facturas (CFDI) emitidas se conservan durante el plazo que exigen las leyes fiscales de México (5 años) y después se eliminan. No se usan para nada más.',
    plazoT: 'Plazo',
    plazo: 'Confirmamos tu solicitud por correo y eliminamos la cuenta en un plazo máximo de 30 días. Los folios que no hayas usado se pierden al eliminar la cuenta.',
    boton: 'Solicitar eliminación de mi cuenta',
    confirmar: '¿Seguro que quieres pedir que se elimine tu cuenta y todos sus datos? Esto no se puede deshacer.',
    enviada: 'Recibimos tu solicitud. Te confirmaremos por correo cuando tu cuenta quede eliminada.',
    error: 'No se pudo enviar la solicitud. Escríbenos a contacto@cotizago.com.mx.',
    entra: 'Inicia sesión para pedirlo desde tu cuenta',
    ticketT: 'Eliminar mi cuenta', ticketD: 'Solicito que se elimine mi cuenta de Cotiza Go y todos sus datos.',
  },
  en: {
    title: 'Delete your Cotiza Go account',
    intro: 'You can ask us at any time to delete your Cotiza Go account and the data associated with it.',
    comoT: 'How to request it',
    como1: 'Sign in (on the web or in the app) and use the «Request account deletion» button on this page.',
    como2: 'Or email contacto@cotizago.com.mx from the address you signed up with, subject «Delete my account».',
    borraT: 'What is deleted',
    borra: 'Your user and access, your company data, clients, products, quotes, templates, integrations (saved keys and passwords) and the files you uploaded (logo, attachments).',
    guardaT: 'What is kept',
    guarda: 'Payment records and issued invoices (CFDI) are kept for the period required by Mexican tax law (5 years) and then deleted. They are not used for anything else.',
    plazoT: 'Timeframe',
    plazo: 'We confirm your request by email and delete the account within 30 days at most. Unused folios are lost when the account is deleted.',
    boton: 'Request account deletion',
    confirmar: 'Are you sure you want your account and all its data deleted? This cannot be undone.',
    enviada: 'We received your request. We will email you when your account has been deleted.',
    error: 'The request could not be sent. Please email contacto@cotizago.com.mx.',
    entra: 'Sign in to request it from your account',
    ticketT: 'Delete my account', ticketD: 'I request that my Cotiza Go account and all its data be deleted.',
  },
  pt: {
    title: 'Excluir sua conta do Cotiza Go',
    intro: 'Você pode pedir a qualquer momento que excluamos sua conta do Cotiza Go e os dados associados a ela.',
    comoT: 'Como pedir',
    como1: 'Entre na sua conta (na web ou no app) e use o botão «Solicitar exclusão da minha conta» desta página.',
    como2: 'Ou escreva para contacto@cotizago.com.mx a partir do e-mail cadastrado, com o assunto «Excluir minha conta».',
    borraT: 'O que é excluído',
    borra: 'Seu usuário e acesso, os dados da sua empresa, clientes, produtos, orçamentos, modelos, integrações (chaves e senhas salvas) e os arquivos enviados (logo, anexos).',
    guardaT: 'O que é mantido',
    guarda: 'Os registros de pagamento e as notas fiscais (CFDI) emitidas são mantidos pelo prazo exigido pela legislação fiscal do México (5 anos) e depois excluídos. Não são usados para mais nada.',
    plazoT: 'Prazo',
    plazo: 'Confirmamos seu pedido por e-mail e excluímos a conta em no máximo 30 dias. Os fólios não usados são perdidos ao excluir a conta.',
    boton: 'Solicitar exclusão da minha conta',
    confirmar: 'Tem certeza de que quer excluir sua conta e todos os dados? Isso não pode ser desfeito.',
    enviada: 'Recebemos seu pedido. Avisaremos por e-mail quando a conta for excluída.',
    error: 'Não foi possível enviar o pedido. Escreva para contacto@cotizago.com.mx.',
    entra: 'Entre para pedir a partir da sua conta',
    ticketT: 'Excluir minha conta', ticketD: 'Solicito a exclusão da minha conta do Cotiza Go e de todos os seus dados.',
  },
  fr: {
    title: 'Supprimer votre compte Cotiza Go',
    intro: 'Vous pouvez nous demander à tout moment de supprimer votre compte Cotiza Go et les données qui y sont associées.',
    comoT: 'Comment le demander',
    como1: 'Connectez-vous (sur le web ou dans l’application) et utilisez le bouton « Demander la suppression de mon compte » de cette page.',
    como2: 'Ou écrivez à contacto@cotizago.com.mx depuis l’adresse d’inscription, avec l’objet « Supprimer mon compte ».',
    borraT: 'Ce qui est supprimé',
    borra: 'Votre utilisateur et votre accès, les données de votre entreprise, clients, produits, devis, modèles, intégrations (clés et mots de passe enregistrés) et les fichiers envoyés (logo, pièces jointes).',
    guardaT: 'Ce qui est conservé',
    guarda: 'Les enregistrements de paiement et les factures (CFDI) émises sont conservés pendant la durée exigée par la loi fiscale mexicaine (5 ans), puis supprimés. Ils ne servent à rien d’autre.',
    plazoT: 'Délai',
    plazo: 'Nous confirmons votre demande par e-mail et supprimons le compte sous 30 jours maximum. Les folios non utilisés sont perdus lors de la suppression.',
    boton: 'Demander la suppression de mon compte',
    confirmar: 'Voulez-vous vraiment supprimer votre compte et toutes ses données ? Cette action est irréversible.',
    enviada: 'Nous avons reçu votre demande. Nous vous confirmerons par e-mail la suppression du compte.',
    error: 'La demande n’a pas pu être envoyée. Écrivez à contacto@cotizago.com.mx.',
    entra: 'Connectez-vous pour le demander depuis votre compte',
    ticketT: 'Supprimer mon compte', ticketD: 'Je demande la suppression de mon compte Cotiza Go et de toutes ses données.',
  },
}

export default function EliminarCuentaPage() {
  const { i18n } = useTranslation()
  const c = T[(i18n.language || 'es').slice(0, 2)] ?? T.es
  const { user, profile } = useAuth()
  const [enviando, setEnviando] = useState(false)
  const [enviada, setEnviada] = useState(false)

  const solicitar = async () => {
    if (!user || !profile?.workspace_id) return
    if (!confirm(c.confirmar)) return
    setEnviando(true)
    try {
      const { data: ticket, error } = await supabase.from('soporte_tickets')
        .insert({ titulo: c.ticketT, descripcion: c.ticketD, prioridad: 'alta', estado: 'abierto', user_id: user.id, workspace_id: profile.workspace_id })
        .select().single()
      if (error) throw error
      await supabase.from('soporte_mensajes').insert({
        ticket_id: ticket.id, workspace_id: profile.workspace_id, user_id: user.id, es_admin: false,
        mensaje: `${c.ticketD} (${user.email})`,
      })
      setEnviada(true)
    } catch { toast.error(c.error) }
    finally { setEnviando(false) }
  }

  const bloques: [string, string][] = [[c.borraT, c.borra], [c.guardaT, c.guarda], [c.plazoT, c.plazo]]

  return (
    <div className="min-h-screen bg-slate-50">
      <NavPublica />
      <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5 text-white" aria-hidden="true" />
          </span>
          <h1 className="text-3xl font-extrabold text-navy-900">{c.title}</h1>
        </div>
        <p className="text-slate-600 mt-6 leading-relaxed">{c.intro}</p>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-navy-900">{c.comoT}</h2>
          <ol className="list-decimal pl-5 text-slate-600 mt-2 space-y-1 leading-relaxed">
            <li>{c.como1}</li>
            <li>{c.como2}</li>
          </ol>
        </section>

        <div className="mt-6 card p-5">
          {enviada ? (
            <p role="status" className="flex items-start gap-2 text-sm text-success-700"><CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" /> {c.enviada}</p>
          ) : user ? (
            <button onClick={solicitar} disabled={enviando} className="btn-secondary w-full justify-center text-red-700">
              {enviando && <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />}
              <UserX className="w-4 h-4" aria-hidden="true" /> {c.boton}
            </button>
          ) : (
            <Link to="/login" className="btn-navy w-full justify-center">{c.entra}</Link>
          )}
        </div>

        <div className="mt-8 space-y-6">
          {bloques.map(([t, d]) => (
            <section key={t}>
              <h2 className="text-lg font-bold text-navy-900">{t}</h2>
              <p className="text-slate-600 mt-2 leading-relaxed">{d}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
