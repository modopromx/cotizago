// Página pública de documentación de la API de Cotiza Go (multi-idioma es/en/pt/fr).
// Enlazada desde el footer de la landing y desde el panel. Explica el endpoint,
// la autenticación, el cuerpo de la petición y la respuesta. La API es solo
// para los planes Negocio y Pro (la creación de llaves está restringida).
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavPublica from '../../components/NavPublica'
import { Plug, KeyRound, ShieldCheck, Zap, ArrowRight, Check, Download } from 'lucide-react'

// Endpoint público con dominio propio (proxy). La función interna queda oculta.
const ENDPOINT = 'https://cotizago.com.mx/api-cotizaciones'

// --- Código de ejemplo (independiente del idioma) ---
const ejemplo = `curl -X POST '${ENDPOINT}' \\
  -H 'Authorization: Bearer cg_live_TU_LLAVE' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "cliente": {
      "nombre": "Juan Pérez",
      "email": "juan@empresa.mx",
      "whatsapp": "5215512345678",
      "empresa": "Empresa SA"
    },
    "moneda": "MXN",
    "items": [
      {
        "nombre": "Desarrollo de sitio web",
        "descripcion": "Diseño e implementación",
        "unidad": "proyecto",
        "cantidad": 1,
        "precio_unitario": 12000,
        "iva_porcentaje": 16,
        "descuento_porcentaje": 0
      }
    ]
  }'`

const respuesta = `{
  "ok": true,
  "id": "018e...",
  "numero": "COT-2026-0021",
  "estado": "enviada",
  "moneda": "MXN",
  "total": 13920,
  "cliente": { "id": "...", "nombre": "Juan Pérez" },
  "public_url": "https://cotizago.com.mx/c/xxxxxxxx",
  "folios_restantes": 297
}`

const n8nFlow = `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "${ENDPOINT}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Authorization", "value": "Bearer cg_live_TU_LLAVE" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"cliente\\": { \\"nombre\\": \\"Juan Pérez\\", \\"email\\": \\"juan@empresa.mx\\" },\\n  \\"items\\": [ { \\"nombre\\": \\"Servicio\\", \\"cantidad\\": 1, \\"precio_unitario\\": 2500, \\"iva_porcentaje\\": 16 } ]\\n}"
      },
      "name": "Cotiza Go — Crear cotización",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [0, 0]
    }
  ],
  "connections": {}
}`

// Metadatos de guías (independientes del idioma). Los pasos van traducidos en T.
const GUIAS_META = [
  { nombre: 'Make (Integromat)', color: 'bg-[#6D00CC]', archivo: '/integraciones/cotizago-make.json', importable: true },
  { nombre: 'n8n', color: 'bg-[#EA4B71]', archivo: '/integraciones/cotizago-n8n.json', importable: true },
  { nombre: 'Zapier', color: 'bg-[#FF4A00]', archivo: '/integraciones/cotizago-zapier.json', importable: false },
  { nombre: 'Pabbly Connect', color: 'bg-[#0B6BCB]', archivo: '/integraciones/cotizago-pabbly.json', importable: false },
]

type Txt = {
  tag: string; h1: string; intro: string
  planTitle: string; planDesc: JSX.Element; verPlanes: string; obtenerLlave: string
  comoEmpezar: string; pasos: string[]
  endpoint: string; auth: string
  ejemploTitulo: string; clienteDesc: JSX.Element; itemsDesc: JSX.Element
  respuestaTitulo: string
  erroresTitulo: string; errores: [string, string][]
  conectarTitulo: string; conectarIntro: JSX.Element
  config: [string, string][]
  importable: string; referencia: string; descPlantilla: string; descConfig: string
  guiaPasos: Record<string, string[]>
  n8nSummary: string; n8nHint: JSX.Element
  recordatorio: JSX.Element
  ctaTitle: string; ctaSub: string; irLlaves: string
  footInicio: string; footContacto: string; footTerminos: string; footPrivacidad: string
}

const T: Record<string, Txt> = {
  es: {
    tag: 'API para desarrolladores', h1: 'Crea cotizaciones desde tus apps',
    intro: 'Conecta Cotiza Go con tu sistema, CRM, tienda o un flujo de automatización (n8n, Zapier, Make) y genera cotizaciones automáticamente. Cada cotización creada por API se envía y te devuelve su enlace público, igual que en el panel.',
    planTitle: 'Disponible en los planes Negocio y Pro',
    planDesc: <>La API y la creación de llaves están incluidas en <strong>Negocio</strong> y <strong>Pro</strong>. Consume 1 folio por cotización, como en el panel.</>,
    verPlanes: 'Ver planes', obtenerLlave: 'Obtener mi llave',
    comoEmpezar: 'Cómo empezar',
    pasos: ['Con plan Negocio o Pro, entra al panel → API / Integraciones y genera tu llave (cg_live_…).', 'Guárdala: se muestra una sola vez (por seguridad solo almacenamos su hash).', 'Haz un POST al endpoint con tu llave y los datos de la cotización.'],
    endpoint: 'Endpoint', auth: 'Autenticación por encabezado:',
    ejemploTitulo: 'Ejemplo de petición',
    clienteDesc: <><strong>nombre</strong> (obligatorio), email, whatsapp, empresa, rfc. Si el email ya existe, reutiliza el cliente.</>,
    itemsDesc: <><strong>nombre</strong> (obligatorio), descripcion, unidad, cantidad, precio_unitario, iva_porcentaje, descuento_porcentaje.</>,
    respuestaTitulo: 'Respuesta',
    erroresTitulo: 'Códigos de error',
    errores: [['401', 'Falta la API key o es inválida / está desactivada.'], ['402', 'Sin folios disponibles: recarga para poder enviar.'], ['400', 'Faltan datos: cliente.nombre o al menos un item con nombre.'], ['500', 'Error interno al crear la cotización.']],
    conectarTitulo: 'Conéctalo con Make, n8n, Zapier o Pabbly',
    conectarIntro: <>Como es un endpoint HTTP estándar, funciona con cualquier plataforma de automatización. Usa el módulo/nodo de <strong>petición HTTP</strong> con estos datos:</>,
    config: [['Método', 'POST'], ['URL', ENDPOINT], ['Header', 'Authorization: Bearer cg_live_TU_LLAVE'], ['Header', 'Content-Type: application/json'], ['Body', 'JSON (el mismo del ejemplo de arriba)']],
    importable: 'Importable', referencia: 'Referencia', descPlantilla: 'Descargar plantilla', descConfig: 'Descargar config.',
    guiaPasos: {
      'Make (Integromat)': ['Crea un escenario → menú (⋯) → «Import Blueprint» y sube el archivo.', 'Abre el módulo HTTP y reemplaza cg_live_TU_LLAVE por tu llave.', `O manual: módulo HTTP «Make a request», POST a ${ENDPOINT}, headers Authorization y Content-Type, body Raw JSON.`],
      'n8n': ['Menú (⋯) → «Import from File» y sube el archivo.', 'Abre el nodo HTTP Request y reemplaza cg_live_TU_LLAVE por tu llave.', 'O manual: nodo «HTTP Request», POST, Send Headers (Authorization) y Send Body (JSON).'],
      'Zapier': ['Agrega la acción «Webhooks by Zapier» → evento «POST».', `URL: ${ENDPOINT} · Payload Type: JSON.`, 'Headers: Authorization = Bearer cg_live_… y Content-Type = application/json.', 'Copia los campos del archivo de referencia (cliente e items) y mapea tu disparador.'],
      'Pabbly Connect': ['En la acción, elige «API by Pabbly» (o Webhook / HTTP Request).', `Method: POST · Endpoint URL: ${ENDPOINT} · Payload Type: JSON.`, 'Headers: Authorization = Bearer cg_live_… y Content-Type = application/json.', 'Copia el body del archivo de referencia y mapea los campos del disparador.'],
    },
    n8nSummary: 'Ver flujo listo para importar',
    n8nHint: <>Copia este JSON y pégalo directamente en el lienzo de n8n. Cambia <code>cg_live_TU_LLAVE</code> por tu llave.</>,
    recordatorio: <>Recuerda: cada cotización creada consume 1 folio y devuelve <code>public_url</code>, que puedes reenviar por WhatsApp o correo desde tu misma automatización.</>,
    ctaTitle: '¿Listo para automatizar tus cotizaciones?', ctaSub: 'Actualiza a Negocio o Pro y obtén tu llave en un minuto.', irLlaves: 'Ir a mis llaves',
    footInicio: 'Inicio', footContacto: 'Contacto', footTerminos: 'Términos', footPrivacidad: 'Privacidad',
  },
  en: {
    tag: 'Developer API', h1: 'Create quotes from your apps',
    intro: 'Connect Cotiza Go with your system, CRM, store or an automation flow (n8n, Zapier, Make) and generate quotes automatically. Every quote created via API is sent and returns its public link, just like in the panel.',
    planTitle: 'Available on the Negocio and Pro plans',
    planDesc: <>The API and key creation are included in <strong>Negocio</strong> and <strong>Pro</strong>. It uses 1 credit per quote, just like the panel.</>,
    verPlanes: 'View plans', obtenerLlave: 'Get my key',
    comoEmpezar: 'How to start',
    pasos: ['With a Negocio or Pro plan, go to the panel → API / Integrations and generate your key (cg_live_…).', 'Save it: it is shown only once (for security we only store its hash).', 'Make a POST to the endpoint with your key and the quote data.'],
    endpoint: 'Endpoint', auth: 'Header authentication:',
    ejemploTitulo: 'Request example',
    clienteDesc: <><strong>nombre</strong> (required), email, whatsapp, empresa, rfc. If the email already exists, the client is reused.</>,
    itemsDesc: <><strong>nombre</strong> (required), descripcion, unidad, cantidad, precio_unitario, iva_porcentaje, descuento_porcentaje.</>,
    respuestaTitulo: 'Response',
    erroresTitulo: 'Error codes',
    errores: [['401', 'Missing API key or it is invalid / disabled.'], ['402', 'No credits available: top up to be able to send.'], ['400', 'Missing data: cliente.nombre or at least one item with a name.'], ['500', 'Internal error creating the quote.']],
    conectarTitulo: 'Connect it with Make, n8n, Zapier or Pabbly',
    conectarIntro: <>Since it’s a standard HTTP endpoint, it works with any automation platform. Use the <strong>HTTP request</strong> module/node with this data:</>,
    config: [['Method', 'POST'], ['URL', ENDPOINT], ['Header', 'Authorization: Bearer cg_live_TU_LLAVE'], ['Header', 'Content-Type: application/json'], ['Body', 'JSON (the same as the example above)']],
    importable: 'Importable', referencia: 'Reference', descPlantilla: 'Download template', descConfig: 'Download config',
    guiaPasos: {
      'Make (Integromat)': ['Create a scenario → menu (⋯) → “Import Blueprint” and upload the file.', 'Open the HTTP module and replace cg_live_TU_LLAVE with your key.', `Or manual: HTTP “Make a request” module, POST to ${ENDPOINT}, Authorization and Content-Type headers, Raw JSON body.`],
      'n8n': ['Menu (⋯) → “Import from File” and upload the file.', 'Open the HTTP Request node and replace cg_live_TU_LLAVE with your key.', 'Or manual: “HTTP Request” node, POST, Send Headers (Authorization) and Send Body (JSON).'],
      'Zapier': ['Add the “Webhooks by Zapier” action → “POST” event.', `URL: ${ENDPOINT} · Payload Type: JSON.`, 'Headers: Authorization = Bearer cg_live_… and Content-Type = application/json.', 'Copy the fields from the reference file (client and items) and map your trigger.'],
      'Pabbly Connect': ['In the action, choose “API by Pabbly” (or Webhook / HTTP Request).', `Method: POST · Endpoint URL: ${ENDPOINT} · Payload Type: JSON.`, 'Headers: Authorization = Bearer cg_live_… and Content-Type = application/json.', 'Copy the body from the reference file and map the trigger fields.'],
    },
    n8nSummary: 'See ready-to-import flow',
    n8nHint: <>Copy this JSON and paste it directly onto the n8n canvas. Change <code>cg_live_TU_LLAVE</code> to your key.</>,
    recordatorio: <>Remember: each created quote uses 1 credit and returns <code>public_url</code>, which you can resend by WhatsApp or email from the same automation.</>,
    ctaTitle: 'Ready to automate your quotes?', ctaSub: 'Upgrade to Negocio or Pro and get your key in a minute.', irLlaves: 'Go to my keys',
    footInicio: 'Home', footContacto: 'Contact', footTerminos: 'Terms', footPrivacidad: 'Privacy',
  },
  pt: {
    tag: 'API para desenvolvedores', h1: 'Crie orçamentos a partir dos seus apps',
    intro: 'Conecte o Cotiza Go ao seu sistema, CRM, loja ou a um fluxo de automação (n8n, Zapier, Make) e gere orçamentos automaticamente. Cada orçamento criado por API é enviado e devolve seu link público, igual ao painel.',
    planTitle: 'Disponível nos planos Negocio e Pro',
    planDesc: <>A API e a criação de chaves estão incluídas em <strong>Negocio</strong> e <strong>Pro</strong>. Consome 1 crédito por orçamento, como no painel.</>,
    verPlanes: 'Ver planos', obtenerLlave: 'Obter minha chave',
    comoEmpezar: 'Como começar',
    pasos: ['Com plano Negocio ou Pro, entre no painel → API / Integrações e gere sua chave (cg_live_…).', 'Guarde-a: é exibida uma única vez (por segurança só armazenamos o hash).', 'Faça um POST no endpoint com sua chave e os dados do orçamento.'],
    endpoint: 'Endpoint', auth: 'Autenticação por cabeçalho:',
    ejemploTitulo: 'Exemplo de requisição',
    clienteDesc: <><strong>nombre</strong> (obrigatório), email, whatsapp, empresa, rfc. Se o e-mail já existir, o cliente é reutilizado.</>,
    itemsDesc: <><strong>nombre</strong> (obrigatório), descripcion, unidad, cantidad, precio_unitario, iva_porcentaje, descuento_porcentaje.</>,
    respuestaTitulo: 'Resposta',
    erroresTitulo: 'Códigos de erro',
    errores: [['401', 'Falta a API key ou é inválida / está desativada.'], ['402', 'Sem créditos disponíveis: recarregue para poder enviar.'], ['400', 'Faltam dados: cliente.nombre ou ao menos um item com nome.'], ['500', 'Erro interno ao criar o orçamento.']],
    conectarTitulo: 'Conecte com Make, n8n, Zapier ou Pabbly',
    conectarIntro: <>Como é um endpoint HTTP padrão, funciona com qualquer plataforma de automação. Use o módulo/nó de <strong>requisição HTTP</strong> com estes dados:</>,
    config: [['Método', 'POST'], ['URL', ENDPOINT], ['Header', 'Authorization: Bearer cg_live_TU_LLAVE'], ['Header', 'Content-Type: application/json'], ['Body', 'JSON (o mesmo do exemplo acima)']],
    importable: 'Importável', referencia: 'Referência', descPlantilla: 'Baixar modelo', descConfig: 'Baixar config.',
    guiaPasos: {
      'Make (Integromat)': ['Crie um cenário → menu (⋯) → “Import Blueprint” e envie o arquivo.', 'Abra o módulo HTTP e substitua cg_live_TU_LLAVE pela sua chave.', `Ou manual: módulo HTTP “Make a request”, POST para ${ENDPOINT}, headers Authorization e Content-Type, body Raw JSON.`],
      'n8n': ['Menu (⋯) → “Import from File” e envie o arquivo.', 'Abra o nó HTTP Request e substitua cg_live_TU_LLAVE pela sua chave.', 'Ou manual: nó “HTTP Request”, POST, Send Headers (Authorization) e Send Body (JSON).'],
      'Zapier': ['Adicione a ação “Webhooks by Zapier” → evento “POST”.', `URL: ${ENDPOINT} · Payload Type: JSON.`, 'Headers: Authorization = Bearer cg_live_… e Content-Type = application/json.', 'Copie os campos do arquivo de referência (cliente e items) e mapeie seu gatilho.'],
      'Pabbly Connect': ['Na ação, escolha “API by Pabbly” (ou Webhook / HTTP Request).', `Method: POST · Endpoint URL: ${ENDPOINT} · Payload Type: JSON.`, 'Headers: Authorization = Bearer cg_live_… e Content-Type = application/json.', 'Copie o body do arquivo de referência e mapeie os campos do gatilho.'],
    },
    n8nSummary: 'Ver fluxo pronto para importar',
    n8nHint: <>Copie este JSON e cole diretamente no canvas do n8n. Troque <code>cg_live_TU_LLAVE</code> pela sua chave.</>,
    recordatorio: <>Lembre-se: cada orçamento criado consome 1 crédito e devolve <code>public_url</code>, que você pode reenviar por WhatsApp ou e-mail a partir da mesma automação.</>,
    ctaTitle: 'Pronto para automatizar seus orçamentos?', ctaSub: 'Atualize para Negocio ou Pro e obtenha sua chave em um minuto.', irLlaves: 'Ir para minhas chaves',
    footInicio: 'Início', footContacto: 'Contato', footTerminos: 'Termos', footPrivacidad: 'Privacidade',
  },
  fr: {
    tag: 'API pour développeurs', h1: 'Créez des devis depuis vos apps',
    intro: 'Connectez Cotiza Go à votre système, CRM, boutique ou un flux d’automatisation (n8n, Zapier, Make) et générez des devis automatiquement. Chaque devis créé par API est envoyé et renvoie son lien public, comme dans le panneau.',
    planTitle: 'Disponible sur les forfaits Negocio et Pro',
    planDesc: <>L’API et la création de clés sont incluses dans <strong>Negocio</strong> et <strong>Pro</strong>. Consomme 1 crédit par devis, comme dans le panneau.</>,
    verPlanes: 'Voir les forfaits', obtenerLlave: 'Obtenir ma clé',
    comoEmpezar: 'Comment démarrer',
    pasos: ['Avec un forfait Negocio ou Pro, allez dans le panneau → API / Intégrations et générez votre clé (cg_live_…).', 'Conservez-la : elle s’affiche une seule fois (par sécurité, nous ne stockons que son hash).', 'Faites un POST vers l’endpoint avec votre clé et les données du devis.'],
    endpoint: 'Endpoint', auth: 'Authentification par en-tête :',
    ejemploTitulo: 'Exemple de requête',
    clienteDesc: <><strong>nombre</strong> (obligatoire), email, whatsapp, empresa, rfc. Si l’e-mail existe déjà, le client est réutilisé.</>,
    itemsDesc: <><strong>nombre</strong> (obligatoire), descripcion, unidad, cantidad, precio_unitario, iva_porcentaje, descuento_porcentaje.</>,
    respuestaTitulo: 'Réponse',
    erroresTitulo: 'Codes d’erreur',
    errores: [['401', 'Clé API manquante ou invalide / désactivée.'], ['402', 'Aucun crédit disponible : rechargez pour pouvoir envoyer.'], ['400', 'Données manquantes : cliente.nombre ou au moins un item avec un nom.'], ['500', 'Erreur interne lors de la création du devis.']],
    conectarTitulo: 'Connectez-le avec Make, n8n, Zapier ou Pabbly',
    conectarIntro: <>Comme c’est un endpoint HTTP standard, il fonctionne avec n’importe quelle plateforme d’automatisation. Utilisez le module/nœud de <strong>requête HTTP</strong> avec ces données :</>,
    config: [['Méthode', 'POST'], ['URL', ENDPOINT], ['Header', 'Authorization: Bearer cg_live_TU_LLAVE'], ['Header', 'Content-Type: application/json'], ['Body', 'JSON (le même que l’exemple ci-dessus)']],
    importable: 'Importable', referencia: 'Référence', descPlantilla: 'Télécharger le modèle', descConfig: 'Télécharger la config',
    guiaPasos: {
      'Make (Integromat)': ['Créez un scénario → menu (⋯) → « Import Blueprint » et importez le fichier.', 'Ouvrez le module HTTP et remplacez cg_live_TU_LLAVE par votre clé.', `Ou manuel : module HTTP « Make a request », POST vers ${ENDPOINT}, en-têtes Authorization et Content-Type, body Raw JSON.`],
      'n8n': ['Menu (⋯) → « Import from File » et importez le fichier.', 'Ouvrez le nœud HTTP Request et remplacez cg_live_TU_LLAVE par votre clé.', 'Ou manuel : nœud « HTTP Request », POST, Send Headers (Authorization) et Send Body (JSON).'],
      'Zapier': ['Ajoutez l’action « Webhooks by Zapier » → événement « POST ».', `URL : ${ENDPOINT} · Payload Type : JSON.`, 'Headers : Authorization = Bearer cg_live_… et Content-Type = application/json.', 'Copiez les champs du fichier de référence (client et items) et mappez votre déclencheur.'],
      'Pabbly Connect': ['Dans l’action, choisissez « API by Pabbly » (ou Webhook / HTTP Request).', `Method : POST · Endpoint URL : ${ENDPOINT} · Payload Type : JSON.`, 'Headers : Authorization = Bearer cg_live_… et Content-Type = application/json.', 'Copiez le body du fichier de référence et mappez les champs du déclencheur.'],
    },
    n8nSummary: 'Voir le flux prêt à importer',
    n8nHint: <>Copiez ce JSON et collez-le directement sur le canevas n8n. Remplacez <code>cg_live_TU_LLAVE</code> par votre clé.</>,
    recordatorio: <>Rappel : chaque devis créé consomme 1 crédit et renvoie <code>public_url</code>, que vous pouvez renvoyer par WhatsApp ou e-mail depuis la même automatisation.</>,
    ctaTitle: 'Prêt à automatiser vos devis ?', ctaSub: 'Passez à Negocio ou Pro et obtenez votre clé en une minute.', irLlaves: 'Aller à mes clés',
    footInicio: 'Accueil', footContacto: 'Contact', footTerminos: 'Conditions', footPrivacidad: 'Confidentialité',
  },
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-navy-900">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    // tabIndex: el bloque se desplaza a lo ancho; así también se recorre con el teclado.
    <pre tabIndex={0} className="bg-navy-900 text-slate-100 rounded-xl p-4 overflow-x-auto text-[12px] leading-relaxed">
      <code>{children}</code>
    </pre>
  )
}

export default function ApiDocsPage() {
  const { i18n } = useTranslation()
  const c = T[i18n.language] ?? T.es

  return (
    <div className="min-h-screen bg-slate-50">
      <NavPublica />

      <main className="max-w-3xl mx-auto px-4 py-12 lg:py-16">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-primary-600 text-navy-900 flex items-center justify-center">
            <Plug className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-widest text-primary-700 uppercase">{c.tag}</p>
            <h1 className="text-3xl font-extrabold text-navy-900">{c.h1}</h1>
          </div>
        </div>
        <p className="mt-4 text-slate-600">{c.intro}</p>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
          <ShieldCheck className="w-5 h-5 text-primary-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-navy-900">{c.planTitle}</p>
            <p className="mt-0.5 text-slate-600">{c.planDesc}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/#paquetes" className="btn-primary text-xs">{c.verPlanes} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>
              <Link to="/app/api" className="btn-secondary text-xs">{c.obtenerLlave} <KeyRound className="w-3.5 h-3.5" aria-hidden="true" /></Link>
            </div>
          </div>
        </div>

        <Bloque titulo={c.comoEmpezar}>
          <ol className="space-y-2 text-sm text-slate-700">
            {c.pasos.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Bloque>

        <Bloque titulo={c.endpoint}>
          <Code>{`POST ${ENDPOINT}`}</Code>
          <p className="mt-3 text-sm text-slate-600 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-500" aria-hidden="true" />
            {c.auth} <code className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs">Authorization: Bearer cg_live_…</code>
          </p>
        </Bloque>

        <Bloque titulo={c.ejemploTitulo}>
          <Code>{ejemplo}</Code>
          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-semibold text-navy-900">cliente</p>
              <p className="text-slate-500 text-xs mt-1">{c.clienteDesc}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-semibold text-navy-900">items[]</p>
              <p className="text-slate-500 text-xs mt-1">{c.itemsDesc}</p>
            </div>
          </div>
        </Bloque>

        <Bloque titulo={c.respuestaTitulo}>
          <Code>{respuesta}</Code>
        </Bloque>

        <Bloque titulo={c.erroresTitulo}>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {c.errores.map(([code, d]) => (
                  <tr key={code}>
                    <td className="px-4 py-2.5 font-mono text-xs text-red-700 align-top w-16">{code}</td>
                    <td className="px-4 py-2.5 text-slate-600">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloque>

        <Bloque titulo={c.conectarTitulo}>
          <p className="text-sm text-slate-600">{c.conectarIntro}</p>

          <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {c.config.map(([k, v], i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 font-medium text-navy-900 align-top w-24">{k}</td>
                    <td className="px-4 py-2.5 text-slate-600 break-all font-mono text-xs">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4">
            {GUIAS_META.map(g => (
              <div key={g.nombre} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-8 h-8 rounded-lg ${g.color} text-white flex items-center justify-center text-xs font-bold`}>
                      {g.nombre[0]}
                    </span>
                    <h3 className="font-bold text-navy-900">{g.nombre}</h3>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${g.importable ? 'bg-success-50 text-success-700' : 'bg-slate-100 text-slate-600'}`}>
                      {g.importable ? c.importable : c.referencia}
                    </span>
                  </div>
                  <a href={g.archivo} download className="btn-secondary text-xs py-1.5 px-3 shrink-0">
                    <Download className="w-3.5 h-3.5" aria-hidden="true" /> {g.importable ? c.descPlantilla : c.descConfig}
                  </a>
                </div>
                <ol className="mt-3 space-y-2 text-sm text-slate-700">
                  {(c.guiaPasos[g.nombre] ?? []).map((p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="break-words">{p}</span>
                    </li>
                  ))}
                </ol>
                {g.nombre === 'n8n' && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-primary-700">{c.n8nSummary}</summary>
                    <p className="mt-2 text-xs text-slate-500">{c.n8nHint}</p>
                    <div className="mt-2"><Code>{n8nFlow}</Code></div>
                  </details>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-500">{c.recordatorio}</p>
        </Bloque>

        <div className="mt-12 rounded-2xl bg-gradient-to-br from-navy-900 to-primary-600 p-8 text-center">
          <Zap className="w-8 h-8 text-primary-200 mx-auto" aria-hidden="true" />
          <h3 className="mt-3 text-xl font-extrabold text-white">{c.ctaTitle}</h3>
          <p className="mt-2 text-primary-100 text-sm">{c.ctaSub}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/#paquetes" className="inline-flex items-center gap-2 bg-white text-navy-900 font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-50 transition-colors text-sm">
              {c.verPlanes} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link to="/app/api" className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-sm">
              {c.irLlaves}
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-primary-700">{c.footInicio}</Link>
          <Link to="/contacto" className="hover:text-primary-700">{c.footContacto}</Link>
          <Link to="/terminos" className="hover:text-primary-700">{c.footTerminos}</Link>
          <Link to="/privacidad" className="hover:text-primary-700">{c.footPrivacidad}</Link>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Check className="w-3.5 h-3.5" aria-hidden="true" /> API v1 · Cotiza Go
        </p>
      </main>
    </div>
  )
}
