// Centro de ayuda / documentación pública de Cotiza Go (multi-idioma: es/en/pt/fr).
// Explica cómo usar cada función, configurar la cuenta, facturar y conectar
// integraciones. Enlazada desde el footer de la landing y el panel de usuario.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavPublica from '../../components/NavPublica'
import {
  Rocket, FileText, Package2, Coins, Receipt, Blocks,
  Plug, Settings, Search, ChevronRight, ArrowRight,
} from 'lucide-react'

// Los iconos son independientes del idioma; se mapean por id de sección.
const ICONS: Record<string, any> = {
  'primeros-pasos': Rocket, 'cotizaciones': FileText, 'catalogo': Package2,
  'folios': Coins, 'facturacion': Receipt, 'modulos': Blocks,
  'integraciones': Plug, 'configuracion': Settings,
}

type Bloque = { sub?: string; pasos: string[] }
type Seccion = { id: string; titulo: string; intro?: string; bloques: Bloque[] }
type Textos = {
  tag: string; title: string; subtitle: string; search: string; noResults: string
  notFound: string; notFoundSub: string; contact: string; apiCta: string
  secciones: Seccion[]
}

const CONTENIDO: Record<string, Textos> = {
  es: {
    tag: 'Centro de ayuda', title: 'Documentación de Cotiza Go',
    subtitle: 'Aprende a cotizar, facturar, contratar módulos y conectar tus integraciones. Todo paso a paso.',
    search: 'Busca un tema…', noResults: 'No encontramos resultados para',
    notFound: '¿No encontraste lo que buscabas?', notFoundSub: 'Escríbenos y te ayudamos.',
    contact: 'Contactar soporte', apiCta: 'Ver la documentación de la API',
    secciones: [
      { id: 'primeros-pasos', titulo: 'Primeros pasos', intro: 'Deja tu cuenta lista para cotizar en menos de 5 minutos.', bloques: [
        { sub: 'Crea tu cuenta', pasos: ['Entra a Registro y crea tu cuenta con tu correo. La confirmación es inmediata.', 'Al registrarte recibes 5 folios de cortesía para que pruebes sin pagar nada.'] },
        { sub: 'Configura tu empresa', pasos: ['Ve a Configuración → Mi empresa.', 'Sube tu logotipo, escribe tu razón social o nombre comercial y tus datos de contacto.', 'Elige tu país y moneda: definen cómo se ven los totales en el PDF.', 'Estos datos aparecen automáticamente en todas tus cotizaciones.'] },
        { sub: '¿Qué son los folios?', pasos: ['Un folio se descuenta cada vez que ENVÍAS una cotización (por WhatsApp o email). Crear y editar no gasta folios.', 'Los folios no caducan y son acumulables.', 'Compra más cuando quieras en Comprar folios.'] },
      ] },
      { id: 'cotizaciones', titulo: 'Crear y enviar cotizaciones', bloques: [
        { sub: 'Crear una cotización', pasos: ['Ve a Cotizaciones → Nueva cotización.', 'Elige un cliente (o créalo al momento) y agrega tus productos o servicios.', 'Ajusta cantidades, precios, descuentos, impuestos y condiciones.', 'El total se calcula solo mientras escribes.'] },
        { sub: 'El PDF profesional', pasos: ['El PDF se genera con tu logo, colores y datos de empresa; no tienes que diseñar nada.', 'Puedes agregar notas, vigencia y condiciones de pago.'] },
        { sub: 'Enviar por WhatsApp o Email', pasos: ['Al terminar, elige Enviar por WhatsApp o Enviar por email.', 'El cliente recibe la cotización al instante, sin descargar archivos ni cambiar de app.', 'Cada envío descuenta 1 folio.'] },
        { sub: 'Enlace público y seguimiento', pasos: ['Cada cotización tiene un enlace público para que el cliente la vea desde su navegador.', 'Desde Cotizaciones puedes consultar, duplicar, editar, marcar como aceptada o cancelar.'] },
      ] },
      { id: 'catalogo', titulo: 'Productos y clientes', bloques: [
        { sub: 'Productos y servicios', pasos: ['En Productos guarda lo que vendes con su precio y unidad.', 'Así los agregas a una cotización con un clic, sin volver a escribirlos.'] },
        { sub: 'Clientes', pasos: ['En Clientes guarda a quién le cotizas: nombre, contacto y datos.', 'Al crear una cotización eliges el cliente de la lista.'] },
      ] },
      { id: 'folios', titulo: 'Folios y pagos', bloques: [
        { sub: 'Comprar folios', pasos: ['Ve a Comprar folios y elige el paquete que necesites.', 'El pago es seguro con tarjeta (Stripe). Los folios se acreditan al instante.'] },
        { sub: 'Paquetes', pasos: ['Consulta los paquetes y precios en la página de precios. A mayor paquete, menor costo por cotización.'] },
      ] },
      { id: 'facturacion', titulo: 'Facturación (CFDI)', intro: 'Genera la factura fiscal (CFDI 4.0) de tus compras de folios o planes.', bloques: [
        { sub: 'Cómo facturar tu compra', pasos: ['Ve a Notas y facturas en tu panel.', 'Junto a cada compra pagada del mes en curso verás el botón Facturar.', 'Captura tus datos fiscales una sola vez; la próxima vez salen pre-llenados.', 'Genera tu factura y descarga el PDF y el XML al instante; también te llega por correo.'] },
        { sub: 'Datos que necesitas', pasos: ['RFC, código postal fiscal, razón social o nombre (EXACTO como en tu Constancia de Situación Fiscal) y régimen fiscal.', 'El uso de CFDI se establece como "Gastos en general" (G03).'] },
        { sub: 'Importante', pasos: ['Solo se puede facturar dentro del mismo mes en que se realizó el pago.', 'Verifica que tus datos coincidan exactamente con el SAT para evitar rechazos.'] },
      ] },
      { id: 'modulos', titulo: 'Módulos', intro: 'Amplía Cotiza Go con módulos que se contratan por separado.', bloques: [
        { sub: 'WhatsApp propio', pasos: ['Envía las cotizaciones desde tu propio número de WhatsApp.', 'Se activa desde Módulos en tu panel.'] },
        { sub: 'Email profesional', pasos: ['Envía los correos desde tu propio dominio, con tu marca.', 'Se activa desde Módulos en tu panel.'] },
        { sub: 'Contratar y facturar', pasos: ['Cada módulo es una suscripción mensual independiente.', 'Los pagos de módulos también se pueden facturar desde Notas y facturas.'] },
      ] },
      { id: 'integraciones', titulo: 'Integraciones y API', intro: 'Conecta Cotiza Go con tus otras herramientas.', bloques: [
        { sub: 'API para desarrolladores', pasos: ['Desde tu panel en API generas tu llave (cg_live_…) para crear cotizaciones desde otras apps.', 'Consulta los endpoints y ejemplos en la documentación de la API.'] },
        { sub: 'Make, n8n, Zapier y Pabbly', pasos: ['En la página de la API encuentras guías y archivos listos para importar en cada plataforma.', 'Solo pega tu llave y conecta tu flujo (por ejemplo: crear una cotización cuando llega un lead).'] },
        { sub: 'Webhooks', pasos: ['Recibe avisos automáticos cuando pasa algo (por ejemplo, una cotización aceptada).', 'Configura la URL de destino desde la sección de API.'] },
      ] },
      { id: 'configuracion', titulo: 'Configuración y equipo', bloques: [
        { sub: 'Idioma', pasos: ['Cotiza Go está disponible en español, inglés, portugués y francés. Cámbialo desde el selector de idioma.'] },
        { sub: 'Equipo', pasos: ['Invita a tu equipo para trabajar sobre la misma cuenta y folios (según tu plan).'] },
        { sub: 'Desde cualquier dispositivo', pasos: ['Cotiza Go funciona desde el navegador de tu celular, tablet o computadora. No necesitas descargar ni instalar nada: entra a cotizago.com.mx e inicia sesión.'] },
      ] },
    ],
  },
  en: {
    tag: 'Help center', title: 'Cotiza Go documentation',
    subtitle: 'Learn how to quote, invoice, add modules and connect your integrations. Step by step.',
    search: 'Search a topic…', noResults: 'No results found for',
    notFound: 'Didn’t find what you were looking for?', notFoundSub: 'Write to us and we’ll help.',
    contact: 'Contact support', apiCta: 'View the API documentation',
    secciones: [
      { id: 'primeros-pasos', titulo: 'Getting started', intro: 'Get your account ready to quote in under 5 minutes.', bloques: [
        { sub: 'Create your account', pasos: ['Go to Sign up and create your account with your email. Confirmation is instant.', 'When you register you get 5 free credits to try it out at no cost.'] },
        { sub: 'Set up your company', pasos: ['Go to Settings → My company.', 'Upload your logo, add your legal or trade name and your contact details.', 'Pick your country and currency: they define how totals look on the PDF.', 'This data appears automatically on every quote.'] },
        { sub: 'What are credits?', pasos: ['A credit is used each time you SEND a quote (via WhatsApp or email). Creating and editing don’t use credits.', 'Credits never expire and are cumulative.', 'Buy more anytime from Buy credits.'] },
      ] },
      { id: 'cotizaciones', titulo: 'Create and send quotes', bloques: [
        { sub: 'Create a quote', pasos: ['Go to Quotes → New quote.', 'Pick a client (or create one on the spot) and add your products or services.', 'Adjust quantities, prices, discounts, taxes and terms.', 'The total updates automatically as you type.'] },
        { sub: 'The professional PDF', pasos: ['The PDF is generated with your logo, colors and company data; you don’t design anything.', 'You can add notes, validity and payment terms.'] },
        { sub: 'Send via WhatsApp or Email', pasos: ['When you’re done, choose Send via WhatsApp or Send by email.', 'Your client gets the quote instantly, with no downloads and no app switching.', 'Each send uses 1 credit.'] },
        { sub: 'Public link and tracking', pasos: ['Every quote has a public link so your client can view it from their browser.', 'From Quotes you can view, duplicate, edit, mark as accepted or cancel.'] },
      ] },
      { id: 'catalogo', titulo: 'Products and clients', bloques: [
        { sub: 'Products and services', pasos: ['In Products, save what you sell with its price and unit.', 'That way you add them to a quote with one click, without retyping.'] },
        { sub: 'Clients', pasos: ['In Clients, save who you quote: name, contact and details.', 'When you create a quote you pick the client from the list.'] },
      ] },
      { id: 'folios', titulo: 'Credits and payments', bloques: [
        { sub: 'Buy credits', pasos: ['Go to Buy credits and choose the package you need.', 'Payment is secure by card (Stripe). Credits are added instantly.'] },
        { sub: 'Packages', pasos: ['See the packages and prices on the pricing page. The bigger the package, the lower the cost per quote.'] },
      ] },
      { id: 'facturacion', titulo: 'Invoicing (CFDI)', intro: 'Generate the tax invoice (CFDI 4.0) for your credit or plan purchases.', bloques: [
        { sub: 'How to invoice your purchase', pasos: ['Go to Notes & invoices in your panel.', 'Next to each paid purchase from the current month you’ll see the Invoice button.', 'Enter your tax details once; next time they come pre-filled.', 'Generate your invoice and download the PDF and XML instantly; it also arrives by email.'] },
        { sub: 'Details you need', pasos: ['RFC, tax ZIP code, legal or personal name (EXACTLY as in your Tax Status Certificate) and tax regime.', 'The CFDI use is set to "General expenses" (G03).'] },
        { sub: 'Important', pasos: ['You can only invoice within the same month the payment was made.', 'Make sure your details match the SAT exactly to avoid rejections.'] },
      ] },
      { id: 'modulos', titulo: 'Modules', intro: 'Extend Cotiza Go with modules you add separately.', bloques: [
        { sub: 'Your own WhatsApp', pasos: ['Send quotes from your own WhatsApp number.', 'Activate it from Modules in your panel.'] },
        { sub: 'Professional email', pasos: ['Send emails from your own domain, with your brand.', 'Activate it from Modules in your panel.'] },
        { sub: 'Subscribe and invoice', pasos: ['Each module is a separate monthly subscription.', 'Module payments can also be invoiced from Notes & invoices.'] },
      ] },
      { id: 'integraciones', titulo: 'Integrations and API', intro: 'Connect Cotiza Go with your other tools.', bloques: [
        { sub: 'Developer API', pasos: ['From your panel under API you generate your key (cg_live_…) to create quotes from other apps.', 'See the endpoints and examples in the API documentation.'] },
        { sub: 'Make, n8n, Zapier and Pabbly', pasos: ['On the API page you’ll find guides and ready-to-import files for each platform.', 'Just paste your key and connect your flow (e.g. create a quote when a lead arrives).'] },
        { sub: 'Webhooks', pasos: ['Get automatic notifications when something happens (e.g. an accepted quote).', 'Set the destination URL from the API section.'] },
      ] },
      { id: 'configuracion', titulo: 'Settings and team', bloques: [
        { sub: 'Language', pasos: ['Cotiza Go is available in Spanish, English, Portuguese and French. Switch it from the language selector.'] },
        { sub: 'Team', pasos: ['Invite your team to work on the same account and credits (depending on your plan).'] },
        { sub: 'From any device', pasos: ['Cotiza Go works from your phone, tablet or computer browser. Nothing to download or install: go to cotizago.com.mx and sign in.'] },
      ] },
    ],
  },
  pt: {
    tag: 'Central de ajuda', title: 'Documentação do Cotiza Go',
    subtitle: 'Aprenda a orçar, faturar, contratar módulos e conectar suas integrações. Passo a passo.',
    search: 'Busque um tema…', noResults: 'Nenhum resultado para',
    notFound: 'Não encontrou o que procurava?', notFoundSub: 'Escreva para nós e ajudamos você.',
    contact: 'Falar com o suporte', apiCta: 'Ver a documentação da API',
    secciones: [
      { id: 'primeros-pasos', titulo: 'Primeiros passos', intro: 'Deixe sua conta pronta para orçar em menos de 5 minutos.', bloques: [
        { sub: 'Crie sua conta', pasos: ['Acesse Cadastro e crie sua conta com seu e-mail. A confirmação é imediata.', 'Ao se cadastrar você recebe 5 créditos de cortesia para testar sem pagar nada.'] },
        { sub: 'Configure sua empresa', pasos: ['Vá em Configuração → Minha empresa.', 'Envie seu logotipo, escreva a razão social ou nome fantasia e seus dados de contato.', 'Escolha país e moeda: definem como aparecem os totais no PDF.', 'Esses dados aparecem automaticamente em todos os orçamentos.'] },
        { sub: 'O que são os créditos?', pasos: ['Um crédito é descontado cada vez que você ENVIA um orçamento (por WhatsApp ou e-mail). Criar e editar não gasta créditos.', 'Os créditos não expiram e são acumuláveis.', 'Compre mais quando quiser em Comprar créditos.'] },
      ] },
      { id: 'cotizaciones', titulo: 'Criar e enviar orçamentos', bloques: [
        { sub: 'Criar um orçamento', pasos: ['Vá em Orçamentos → Novo orçamento.', 'Escolha um cliente (ou crie na hora) e adicione seus produtos ou serviços.', 'Ajuste quantidades, preços, descontos, impostos e condições.', 'O total é calculado sozinho enquanto você digita.'] },
        { sub: 'O PDF profissional', pasos: ['O PDF é gerado com seu logo, cores e dados da empresa; você não precisa desenhar nada.', 'Você pode adicionar notas, validade e condições de pagamento.'] },
        { sub: 'Enviar por WhatsApp ou E-mail', pasos: ['Ao terminar, escolha Enviar por WhatsApp ou Enviar por e-mail.', 'O cliente recebe o orçamento na hora, sem baixar arquivos nem trocar de app.', 'Cada envio desconta 1 crédito.'] },
        { sub: 'Link público e acompanhamento', pasos: ['Cada orçamento tem um link público para o cliente ver pelo navegador.', 'Em Orçamentos você pode consultar, duplicar, editar, marcar como aceito ou cancelar.'] },
      ] },
      { id: 'catalogo', titulo: 'Produtos e clientes', bloques: [
        { sub: 'Produtos e serviços', pasos: ['Em Produtos, salve o que você vende com preço e unidade.', 'Assim você os adiciona a um orçamento com um clique, sem redigitar.'] },
        { sub: 'Clientes', pasos: ['Em Clientes, salve para quem você orça: nome, contato e dados.', 'Ao criar um orçamento você escolhe o cliente da lista.'] },
      ] },
      { id: 'folios', titulo: 'Créditos e pagamentos', bloques: [
        { sub: 'Comprar créditos', pasos: ['Vá em Comprar créditos e escolha o pacote que precisar.', 'O pagamento é seguro com cartão (Stripe). Os créditos entram na hora.'] },
        { sub: 'Pacotes', pasos: ['Veja os pacotes e preços na página de preços. Quanto maior o pacote, menor o custo por orçamento.'] },
      ] },
      { id: 'facturacion', titulo: 'Faturamento (CFDI)', intro: 'Gere a fatura fiscal (CFDI 4.0) das suas compras de créditos ou planos.', bloques: [
        { sub: 'Como faturar sua compra', pasos: ['Vá em Notas e faturas no seu painel.', 'Ao lado de cada compra paga do mês atual você verá o botão Faturar.', 'Preencha seus dados fiscais uma única vez; na próxima já vêm preenchidos.', 'Gere sua fatura e baixe o PDF e o XML na hora; também chega por e-mail.'] },
        { sub: 'Dados necessários', pasos: ['RFC, CEP fiscal, razão social ou nome (EXATAMENTE como na sua Constância Fiscal) e regime fiscal.', 'O uso do CFDI é definido como "Gastos gerais" (G03).'] },
        { sub: 'Importante', pasos: ['Só é possível faturar dentro do mesmo mês em que o pagamento foi feito.', 'Confira que seus dados coincidem exatamente com o SAT para evitar rejeições.'] },
      ] },
      { id: 'modulos', titulo: 'Módulos', intro: 'Amplie o Cotiza Go com módulos contratados à parte.', bloques: [
        { sub: 'WhatsApp próprio', pasos: ['Envie os orçamentos do seu próprio número de WhatsApp.', 'Ative em Módulos no seu painel.'] },
        { sub: 'E-mail profissional', pasos: ['Envie os e-mails do seu próprio domínio, com sua marca.', 'Ative em Módulos no seu painel.'] },
        { sub: 'Contratar e faturar', pasos: ['Cada módulo é uma assinatura mensal independente.', 'Os pagamentos de módulos também podem ser faturados em Notas e faturas.'] },
      ] },
      { id: 'integraciones', titulo: 'Integrações e API', intro: 'Conecte o Cotiza Go com suas outras ferramentas.', bloques: [
        { sub: 'API para desenvolvedores', pasos: ['No seu painel em API você gera sua chave (cg_live_…) para criar orçamentos de outros apps.', 'Veja os endpoints e exemplos na documentação da API.'] },
        { sub: 'Make, n8n, Zapier e Pabbly', pasos: ['Na página da API há guias e arquivos prontos para importar em cada plataforma.', 'Basta colar sua chave e conectar seu fluxo (ex.: criar um orçamento quando chega um lead).'] },
        { sub: 'Webhooks', pasos: ['Receba avisos automáticos quando algo acontece (ex.: um orçamento aceito).', 'Configure a URL de destino na seção de API.'] },
      ] },
      { id: 'configuracion', titulo: 'Configuração e equipe', bloques: [
        { sub: 'Idioma', pasos: ['O Cotiza Go está disponível em espanhol, inglês, português e francês. Troque no seletor de idioma.'] },
        { sub: 'Equipe', pasos: ['Convide sua equipe para trabalhar na mesma conta e créditos (conforme seu plano).'] },
        { sub: 'De qualquer dispositivo', pasos: ['O Cotiza Go funciona pelo navegador do celular, tablet ou computador. Não precisa baixar nem instalar nada: acesse cotizago.com.mx e entre.'] },
      ] },
    ],
  },
  fr: {
    tag: 'Centre d’aide', title: 'Documentation de Cotiza Go',
    subtitle: 'Apprenez à faire des devis, facturer, ajouter des modules et connecter vos intégrations. Étape par étape.',
    search: 'Rechercher un sujet…', noResults: 'Aucun résultat pour',
    notFound: 'Vous n’avez pas trouvé ?', notFoundSub: 'Écrivez-nous et nous vous aidons.',
    contact: 'Contacter le support', apiCta: 'Voir la documentation de l’API',
    secciones: [
      { id: 'primeros-pasos', titulo: 'Premiers pas', intro: 'Préparez votre compte pour faire des devis en moins de 5 minutes.', bloques: [
        { sub: 'Créez votre compte', pasos: ['Allez sur Inscription et créez votre compte avec votre e-mail. La confirmation est immédiate.', 'À l’inscription vous recevez 5 crédits offerts pour tester sans rien payer.'] },
        { sub: 'Configurez votre entreprise', pasos: ['Allez dans Configuration → Mon entreprise.', 'Téléchargez votre logo, indiquez votre raison sociale ou nom commercial et vos coordonnées.', 'Choisissez pays et devise : ils définissent l’affichage des totaux sur le PDF.', 'Ces données apparaissent automatiquement sur tous vos devis.'] },
        { sub: 'Qu’est-ce qu’un crédit ?', pasos: ['Un crédit est déduit chaque fois que vous ENVOYEZ un devis (par WhatsApp ou e-mail). Créer et modifier ne consomme pas de crédits.', 'Les crédits n’expirent pas et sont cumulables.', 'Achetez-en quand vous voulez dans Acheter des crédits.'] },
      ] },
      { id: 'cotizaciones', titulo: 'Créer et envoyer des devis', bloques: [
        { sub: 'Créer un devis', pasos: ['Allez dans Devis → Nouveau devis.', 'Choisissez un client (ou créez-le sur le moment) et ajoutez vos produits ou services.', 'Ajustez quantités, prix, remises, taxes et conditions.', 'Le total se calcule tout seul pendant que vous saisissez.'] },
        { sub: 'Le PDF professionnel', pasos: ['Le PDF est généré avec votre logo, vos couleurs et vos données d’entreprise ; rien à concevoir.', 'Vous pouvez ajouter des notes, une validité et des conditions de paiement.'] },
        { sub: 'Envoyer par WhatsApp ou E-mail', pasos: ['À la fin, choisissez Envoyer par WhatsApp ou Envoyer par e-mail.', 'Votre client reçoit le devis à l’instant, sans téléchargement ni changement d’application.', 'Chaque envoi consomme 1 crédit.'] },
        { sub: 'Lien public et suivi', pasos: ['Chaque devis a un lien public pour que le client le voie depuis son navigateur.', 'Depuis Devis vous pouvez consulter, dupliquer, modifier, marquer comme accepté ou annuler.'] },
      ] },
      { id: 'catalogo', titulo: 'Produits et clients', bloques: [
        { sub: 'Produits et services', pasos: ['Dans Produits, enregistrez ce que vous vendez avec son prix et son unité.', 'Ainsi vous les ajoutez à un devis en un clic, sans les ressaisir.'] },
        { sub: 'Clients', pasos: ['Dans Clients, enregistrez à qui vous faites des devis : nom, contact et données.', 'À la création d’un devis vous choisissez le client dans la liste.'] },
      ] },
      { id: 'folios', titulo: 'Crédits et paiements', bloques: [
        { sub: 'Acheter des crédits', pasos: ['Allez dans Acheter des crédits et choisissez le pack qu’il vous faut.', 'Le paiement est sécurisé par carte (Stripe). Les crédits sont ajoutés à l’instant.'] },
        { sub: 'Packs', pasos: ['Consultez les packs et prix sur la page des tarifs. Plus le pack est grand, plus le coût par devis baisse.'] },
      ] },
      { id: 'facturacion', titulo: 'Facturation (CFDI)', intro: 'Générez la facture fiscale (CFDI 4.0) de vos achats de crédits ou de forfaits.', bloques: [
        { sub: 'Comment facturer votre achat', pasos: ['Allez dans Notes et factures dans votre panneau.', 'À côté de chaque achat payé du mois en cours, vous verrez le bouton Facturer.', 'Saisissez vos données fiscales une seule fois ; la prochaine fois elles sont pré-remplies.', 'Générez votre facture et téléchargez le PDF et le XML à l’instant ; elle arrive aussi par e-mail.'] },
        { sub: 'Données nécessaires', pasos: ['RFC, code postal fiscal, raison sociale ou nom (EXACTEMENT comme sur votre Constancia fiscale) et régime fiscal.', 'L’usage du CFDI est défini sur « Dépenses générales » (G03).'] },
        { sub: 'Important', pasos: ['On ne peut facturer que dans le même mois où le paiement a été effectué.', 'Vérifiez que vos données correspondent exactement au SAT pour éviter les rejets.'] },
      ] },
      { id: 'modulos', titulo: 'Modules', intro: 'Étendez Cotiza Go avec des modules souscrits séparément.', bloques: [
        { sub: 'WhatsApp propre', pasos: ['Envoyez les devis depuis votre propre numéro WhatsApp.', 'Activez-le depuis Modules dans votre panneau.'] },
        { sub: 'E-mail professionnel', pasos: ['Envoyez les e-mails depuis votre propre domaine, avec votre marque.', 'Activez-le depuis Modules dans votre panneau.'] },
        { sub: 'Souscrire et facturer', pasos: ['Chaque module est un abonnement mensuel indépendant.', 'Les paiements des modules peuvent aussi être facturés depuis Notes et factures.'] },
      ] },
      { id: 'integraciones', titulo: 'Intégrations et API', intro: 'Connectez Cotiza Go à vos autres outils.', bloques: [
        { sub: 'API pour développeurs', pasos: ['Depuis votre panneau, dans API, vous générez votre clé (cg_live_…) pour créer des devis depuis d’autres apps.', 'Consultez les endpoints et exemples dans la documentation de l’API.'] },
        { sub: 'Make, n8n, Zapier et Pabbly', pasos: ['Sur la page de l’API vous trouvez des guides et des fichiers prêts à importer pour chaque plateforme.', 'Collez simplement votre clé et connectez votre flux (ex. : créer un devis à l’arrivée d’un prospect).'] },
        { sub: 'Webhooks', pasos: ['Recevez des notifications automatiques quand il se passe quelque chose (ex. : un devis accepté).', 'Configurez l’URL de destination dans la section API.'] },
      ] },
      { id: 'configuracion', titulo: 'Configuration et équipe', bloques: [
        { sub: 'Langue', pasos: ['Cotiza Go est disponible en espagnol, anglais, portugais et français. Changez-la depuis le sélecteur de langue.'] },
        { sub: 'Équipe', pasos: ['Invitez votre équipe à travailler sur le même compte et les mêmes crédits (selon votre forfait).'] },
        { sub: 'Depuis n’importe quel appareil', pasos: ['Cotiza Go fonctionne depuis le navigateur de votre téléphone, tablette ou ordinateur. Rien à télécharger ni à installer : allez sur cotizago.com.mx et connectez-vous.'] },
      ] },
    ],
  },
}

export default function DocumentacionPage() {
  const { i18n } = useTranslation()
  const c = CONTENIDO[i18n.language] ?? CONTENIDO.es
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const visibles = term
    ? c.secciones.filter(s =>
        (s.titulo + ' ' + (s.intro ?? '') + ' ' + s.bloques.map(b => (b.sub ?? '') + ' ' + b.pasos.join(' ')).join(' '))
          .toLowerCase().includes(term))
    : c.secciones

  return (
    <div className="min-h-screen bg-slate-50">
      <NavPublica />
      <header className="bg-navy-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <p className="text-xs font-semibold tracking-widest text-primary-300 uppercase">{c.tag}</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold">{c.title}</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">{c.subtitle}</p>
          <div className="mt-6 relative max-w-md">
            {/* Fondo navy: ícono y placeholder claros (el gris oscuro no se leía) */}
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" aria-hidden="true" />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={c.search} aria-label={c.search}
              className="w-full rounded-xl bg-white/10 border border-white/15 pl-9 pr-3 py-2.5 text-base sm:text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[220px_1fr] gap-10">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1" aria-label={c.title}>
            {c.secciones.map(s => {
              const Icon = ICONS[s.id] ?? FileText
              return (
                <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-white hover:text-primary-700 transition-colors">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /> {s.titulo}
                </a>
              )
            })}
          </nav>
        </aside>

        <div className="space-y-8 min-w-0">
          {visibles.length === 0 && (
            <div role="status" className="card p-8 text-center text-slate-500 text-sm">{c.noResults} “{q}”.</div>
          )}
          {visibles.map(s => {
            const Icon = ICONS[s.id] ?? FileText
            return (
              <section key={s.id} id={s.id} className="card p-6 scroll-mt-24">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary-50 text-primary-700"><Icon className="w-5 h-5" aria-hidden="true" /></span>
                  <h2 className="text-xl font-bold text-navy-900">{s.titulo}</h2>
                </div>
                {s.intro && <p className="mt-2 text-sm text-slate-500">{s.intro}</p>}
                <div className="mt-5 space-y-5">
                  {s.bloques.map((b, i) => (
                    <div key={i}>
                      {b.sub && <h3 className="text-sm font-semibold text-navy-900 mb-2">{b.sub}</h3>}
                      <ul className="space-y-2">
                        {b.pasos.map((p, j) => (
                          <li key={j} className="flex gap-2 text-sm text-slate-600 leading-relaxed">
                            <ChevronRight className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {s.id === 'integraciones' && (
                  <Link to="/api" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline">
                    {c.apiCta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                )}
              </section>
            )
          })}

          <div className="card p-6 bg-primary-50/50 border-primary-100">
            <p className="text-sm font-semibold text-navy-900">{c.notFound}</p>
            <p className="text-sm text-slate-600 mt-1">{c.notFoundSub}</p>
            <Link to="/contacto" className="btn-primary mt-3 inline-flex">{c.contact}</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
