// Globos guía (coachmarks) del onboarding, con driver.js.
// Cada "tour" es de UNA sola pantalla y apunta a elementos marcados con
// [data-tour="..."]. Se lanzan desde la tarjeta "Primeros pasos" navegando a la
// pantalla con ?tour=<clave>; AppLayout detecta el parámetro y llama iniciarTour.
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

type Paso = { el: string; titulo: string; texto: string }

const TOURS: Record<string, Paso[]> = {
  empresa: [
    {
      el: '[data-tour="cfg-logo"]',
      titulo: 'Paso 1 · Tu marca',
      texto: 'Sube tu logo aquí. En las pestañas de arriba completa tus datos fiscales y tu CLABE / datos de pago: todo eso aparece en cada cotización. Al final pulsa Guardar.',
    },
  ],
  productos: [
    {
      el: '[data-tour="prod-nuevo"]',
      titulo: 'Paso 2 · Tus servicios',
      texto: 'Crea tus productos o servicios con su precio y unidad (servicio, hora, mes…). Después los reutilizas en cualquier cotización con un clic.',
    },
  ],
  clientes: [
    {
      el: '[data-tour="cli-nuevo"]',
      titulo: 'Paso 3 · Tus clientes',
      texto: 'Registra a tus clientes una vez y cotízales en segundos. También puedes crearlos al vuelo desde una cotización.',
    },
  ],
  cotizacion: [
    {
      el: '[data-tour="cot-cliente"]',
      titulo: 'Paso 4 · Elige el cliente',
      texto: 'Selecciona a quién va dirigida la cotización. Sus datos se imprimen en el PDF y en el enlace público.',
    },
    {
      el: '[data-tour="cot-concepto"]',
      titulo: 'Agrega conceptos',
      texto: 'Añade conceptos y elígelos “Del catálogo…” para que se llenen solos con su precio y unidad. Puedes ajustar cantidad, descuento e IVA por concepto.',
    },
    {
      el: '[data-tour="cot-guardar"]',
      titulo: 'Guarda la cotización',
      texto: 'Guárdala. Después la envías por WhatsApp, correo o enlace desde tu lista de cotizaciones.',
    },
  ],
  enviar: [
    {
      el: '[data-tour="cot-enviar"]',
      titulo: 'Paso 5 · Envíala',
      texto: 'Con este botón la mandas por WhatsApp. Al enviarla (o copiar el enlace) se consume 1 folio y el enlace público queda activo para tu cliente.',
    },
  ],
}

// El mismo data-tour puede existir dos veces (tabla de escritorio y tarjetas de
// celular, una de ellas oculta): se usa el primero que esté visible.
const visible = (sel: string) =>
  [...document.querySelectorAll<HTMLElement>(sel)].find(el => el.offsetParent !== null || el.getClientRects().length > 0)

// Lanza el tour esperando a que exista el primer elemento (la pantalla puede
// estar montándose). Reintenta ~4s y si no aparece, no hace nada.
export function iniciarTour(clave: string) {
  const pasos = TOURS[clave]
  if (!pasos?.length) return
  let intentos = 0
  const lanzar = () => {
    if (!visible(pasos[0].el) && intentos++ < 25) {
      setTimeout(lanzar, 160)
      return
    }
    driver({
      allowClose: true,
      showProgress: pasos.length > 1,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Entendido',
      steps: pasos.map(p => ({
        element: () => visible(p.el) ?? document.querySelector(p.el) ?? document.body,
        popover: { title: p.titulo, description: p.texto, side: 'bottom', align: 'start' },
      })),
    }).drive()
  }
  lanzar()
}
