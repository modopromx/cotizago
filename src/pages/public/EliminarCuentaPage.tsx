// Eliminar la cuenta de Cotiza Go (requisito de Google Play: una página web y una
// forma dentro de la app para borrar la cuenta y sus datos).
// (29-oct-2026) Pública: explica el proceso. Con sesión iniciada (también dentro
// de la app de Android) el usuario escribe ELIMINAR y la cuenta se borra AL
// MOMENTO, sin aprobación (función eliminar-cuenta). Decisión de Omar.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import NavPublica from '../../components/NavPublica'
import { UserX, CheckCircle2, AlertTriangle } from 'lucide-react'

const PALABRA = 'ELIMINAR'

const T: Record<string, any> = {
  es: {
    title: 'Eliminar tu cuenta de Cotiza Go',
    intro: 'Puedes eliminar en cualquier momento tu cuenta de Cotiza Go y los datos asociados a ella. Se elimina al instante.',
    comoT: 'Cómo hacerlo',
    como1: 'Entra a tu cuenta (en la web o en la app) y abre «Eliminar mi cuenta» en el menú de tu perfil, o vuelve a esta página.',
    como2: 'Escribe ELIMINAR para confirmar y presiona el botón. Tu cuenta se borra en ese momento.',
    borraT: 'Qué se borra',
    borra: 'Tu usuario y acceso, los datos de tu empresa, tus clientes, productos, cotizaciones, plantillas, integraciones (llaves y contraseñas guardadas) y los archivos que subiste (logo, adjuntos). Las suscripciones de módulos se cancelan y ya no se cobran.',
    guardaT: 'Qué se conserva',
    guarda: 'Los registros de pagos y las facturas (CFDI) emitidas se conservan durante el plazo que exigen las leyes fiscales de México (5 años) y después se eliminan. No se usan para nada más.',
    plazoT: 'Plazo',
    plazo: 'Inmediato. Al terminar te enviamos un correo de confirmación. Los folios que no hayas usado se pierden y no hay reembolsos.',
    aviso: 'Esto no se puede deshacer. Para confirmar, escribe ELIMINAR:',
    boton: 'Eliminar mi cuenta ahora',
    hecho: 'Tu cuenta y tus datos fueron eliminados. Te enviamos un correo de confirmación.',
    error: 'No se pudo eliminar la cuenta. Intenta de nuevo o escríbenos a contacto@cotizago.com.mx.',
    entra: 'Inicia sesión para eliminar tu cuenta',
  },
  en: {
    title: 'Delete your Cotiza Go account',
    intro: 'You can delete your Cotiza Go account and its data at any time. Deletion is immediate.',
    comoT: 'How to do it',
    como1: 'Sign in (on the web or in the app) and open «Delete my account» from your profile menu, or come back to this page.',
    como2: 'Type ELIMINAR to confirm and press the button. Your account is deleted right away.',
    borraT: 'What is deleted',
    borra: 'Your user and access, your company data, clients, products, quotes, templates, integrations (saved keys and passwords) and the files you uploaded (logo, attachments). Module subscriptions are cancelled and no longer charged.',
    guardaT: 'What is kept',
    guarda: 'Payment records and issued invoices (CFDI) are kept for the period required by Mexican tax law (5 years) and then deleted. They are not used for anything else.',
    plazoT: 'Timeframe',
    plazo: 'Immediate. We email you a confirmation when it is done. Unused folios are lost and there are no refunds.',
    aviso: 'This cannot be undone. To confirm, type ELIMINAR:',
    boton: 'Delete my account now',
    hecho: 'Your account and data were deleted. We sent you a confirmation email.',
    error: 'The account could not be deleted. Try again or email contacto@cotizago.com.mx.',
    entra: 'Sign in to delete your account',
  },
  pt: {
    title: 'Excluir sua conta do Cotiza Go',
    intro: 'Você pode excluir a qualquer momento sua conta do Cotiza Go e os dados associados a ela. A exclusão é imediata.',
    comoT: 'Como fazer',
    como1: 'Entre na sua conta (na web ou no app) e abra «Excluir minha conta» no menu do seu perfil, ou volte a esta página.',
    como2: 'Digite ELIMINAR para confirmar e toque no botão. Sua conta é excluída na hora.',
    borraT: 'O que é excluído',
    borra: 'Seu usuário e acesso, os dados da sua empresa, clientes, produtos, orçamentos, modelos, integrações (chaves e senhas salvas) e os arquivos enviados (logo, anexos). As assinaturas de módulos são canceladas e não são mais cobradas.',
    guardaT: 'O que é mantido',
    guarda: 'Os registros de pagamento e as notas fiscais (CFDI) emitidas são mantidos pelo prazo exigido pela legislação fiscal do México (5 anos) e depois excluídos. Não são usados para mais nada.',
    plazoT: 'Prazo',
    plazo: 'Imediato. Ao terminar enviamos um e-mail de confirmação. Os fólios não usados são perdidos e não há reembolsos.',
    aviso: 'Isso não pode ser desfeito. Para confirmar, digite ELIMINAR:',
    boton: 'Excluir minha conta agora',
    hecho: 'Sua conta e seus dados foram excluídos. Enviamos um e-mail de confirmação.',
    error: 'Não foi possível excluir a conta. Tente de novo ou escreva para contacto@cotizago.com.mx.',
    entra: 'Entre para excluir sua conta',
  },
  fr: {
    title: 'Supprimer votre compte Cotiza Go',
    intro: 'Vous pouvez supprimer à tout moment votre compte Cotiza Go et ses données. La suppression est immédiate.',
    comoT: 'Comment faire',
    como1: 'Connectez-vous (sur le web ou dans l’application) et ouvrez « Supprimer mon compte » dans le menu de votre profil, ou revenez sur cette page.',
    como2: 'Tapez ELIMINAR pour confirmer et appuyez sur le bouton. Votre compte est supprimé immédiatement.',
    borraT: 'Ce qui est supprimé',
    borra: 'Votre utilisateur et votre accès, les données de votre entreprise, clients, produits, devis, modèles, intégrations (clés et mots de passe enregistrés) et les fichiers envoyés (logo, pièces jointes). Les abonnements aux modules sont annulés et ne sont plus facturés.',
    guardaT: 'Ce qui est conservé',
    guarda: 'Les enregistrements de paiement et les factures (CFDI) émises sont conservés pendant la durée exigée par la loi fiscale mexicaine (5 ans), puis supprimés. Ils ne servent à rien d’autre.',
    plazoT: 'Délai',
    plazo: 'Immédiat. Nous vous envoyons un e-mail de confirmation. Les folios non utilisés sont perdus et il n’y a pas de remboursement.',
    aviso: 'Cette action est irréversible. Pour confirmer, tapez ELIMINAR :',
    boton: 'Supprimer mon compte maintenant',
    hecho: 'Votre compte et vos données ont été supprimés. Nous vous avons envoyé un e-mail de confirmation.',
    error: 'Le compte n’a pas pu être supprimé. Réessayez ou écrivez à contacto@cotizago.com.mx.',
    entra: 'Connectez-vous pour supprimer votre compte',
  },
}

export default function EliminarCuentaPage() {
  const { i18n } = useTranslation()
  const c = T[(i18n.language || 'es').slice(0, 2)] ?? T.es
  const { user, signOut } = useAuth()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [error, setError] = useState('')

  const eliminar = async () => {
    if (texto.trim().toUpperCase() !== PALABRA) return
    setEnviando(true); setError('')
    try {
      const { data, error } = await supabase.functions.invoke('eliminar-cuenta', { body: { confirmar: PALABRA } })
      if (error || !data?.ok) throw new Error(data?.error || error?.message)
      setHecho(true)
      await signOut().catch(() => {})
    } catch (e: any) {
      setError(e?.message && !/non-2xx/i.test(e.message) ? e.message : c.error)
    } finally { setEnviando(false) }
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
          {hecho ? (
            <p role="status" className="flex items-start gap-2 text-sm text-success-700"><CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" /> {c.hecho}</p>
          ) : user ? (
            <div className="space-y-3">
              <label htmlFor="eliminar-confirmar" className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {c.aviso}
              </label>
              <input id="eliminar-confirmar" className="input" autoComplete="off" autoCapitalize="characters" value={texto} onChange={e => setTexto(e.target.value)} placeholder={PALABRA} />
              <button onClick={eliminar} disabled={enviando || texto.trim().toUpperCase() !== PALABRA}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {enviando
                  ? <span role="status" aria-label="Cargando" className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <UserX className="w-4 h-4" aria-hidden="true" />}
                {c.boton}
              </button>
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            </div>
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
