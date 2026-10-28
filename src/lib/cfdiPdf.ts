// Generador de la representación impresa de un CFDI 4.0 a partir de su XML.
// Se usa en el portal de facturación para que cada factura salga con el LOGO de
// la app correspondiente (no el de Cotiza Go), su QR de verificación del SAT y
// los sellos. El XML es el documento fiscal; esto es solo su representación.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { descargarPDF } from './descarga'

export interface MarcaCFDI { nombre?: string | null; logo_url?: string | null; color?: string | null }

const money = (v: any, m = 'MXN') =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: m }).format(Number(v) || 0)

function hexToRgb(hex?: string | null): [number, number, number] {
  const h = (hex || '#06213B').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

async function urlADataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url); if (!r.ok) return null
    const blob = await r.blob()
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = () => res(null); fr.readAsDataURL(blob) })
  } catch { return null }
}

function attr(el: Element | null, name: string) { return el?.getAttribute(name) ?? '' }

export async function construirCFDIPDF(xmlText: string, marca: MarcaCFDI = {}) {
  const xml = new (window as any).DOMParser().parseFromString(xmlText, 'application/xml') as Document
  // Buscamos por NAMESPACE (no por prefijo): cada emisor usa prefijos distintos
  // (cfdi, tfd, ns0…), pero el namespace es fijo.
  const NS_CFDI = 'http://www.sat.gob.mx/cfd/4'
  const NS_TFD = 'http://www.sat.gob.mx/TimbreFiscalDigital'
  const gc = (local: string) => xml.getElementsByTagNameNS(NS_CFDI, local)
  const gt = (local: string) => xml.getElementsByTagNameNS(NS_TFD, local)
  const doc = new jsPDF()
  const comp = gc('Comprobante')[0] as Element
  const emisor = gc('Emisor')[0] as Element
  const receptor = gc('Receptor')[0] as Element
  const tfd = gt('TimbreFiscalDigital')[0] as Element
  // El nodo Impuestos existe a nivel Concepto y a nivel Comprobante; solo el del
  // comprobante trae TotalImpuestosTrasladados.
  const impuestos = (Array.from(gc('Impuestos')) as Element[]).find(e => e.getAttribute('TotalImpuestosTrasladados') != null) ?? null
  const conceptos = Array.from(gc('Concepto'))

  const moneda = attr(comp, 'Moneda') || 'MXN'
  const subtotal = Number(attr(comp, 'SubTotal')) || 0
  const total = Number(attr(comp, 'Total')) || 0
  const descuento = Number(attr(comp, 'Descuento')) || 0
  const iva = impuestos ? Number(attr(impuestos, 'TotalImpuestosTrasladados')) || 0 : Math.max(0, total - subtotal + descuento)
  const uuid = attr(tfd, 'UUID')
  const selloCFD = attr(tfd, 'SelloCFD')
  const selloSAT = attr(tfd, 'SelloSAT')
  const fechaTimbrado = attr(tfd, 'FechaTimbrado')
  const rfcPac = attr(tfd, 'RfcProvCertif')
  const noCertSAT = attr(tfd, 'NoCertificadoSAT')
  const tfdVer = attr(tfd, 'Version') || '1.1'
  const reEmisor = attr(emisor, 'Rfc'), rrReceptor = attr(receptor, 'Rfc')

  const cadena = `||${tfdVer}|${uuid}|${fechaTimbrado}|${rfcPac}|${selloCFD}|${noCertSAT}||`
  const qrTexto = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${uuid}&re=${reEmisor}&rr=${rrReceptor}&tt=${total}&fe=${selloCFD.slice(-8)}`

  const A = hexToRgb(marca.color)
  const MARGEN = 14, ANCHO = 210
  const logo = marca.logo_url ? await urlADataUrl(marca.logo_url) : null

  // Encabezado: logo/nombre a la izquierda, título a la derecha.
  // El logo se ajusta DENTRO de una caja máxima respetando su proporción real
  // (así no se ve aplastado si es cuadrado o vertical).
  let logoOk = false
  if (logo) {
    try {
      const props: any = doc.getImageProperties(logo)
      const maxW = 40, maxH = 20
      const r = Math.min(maxW / props.width, maxH / props.height)
      const w = props.width * r, h = props.height * r
      doc.addImage(logo, 'PNG', MARGEN, 12, w, h, undefined, 'FAST')
      logoOk = true
    } catch { /* cae al texto */ }
  }
  if (!logoOk) { doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...A); doc.text(marca.nombre || 'Factura', MARGEN, 20) }

  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...A)
  doc.text('FACTURA · CFDI 4.0', ANCHO - MARGEN, 16, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(90, 100, 110)
  doc.text('Folio fiscal (UUID):', ANCHO - MARGEN, 22, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(40, 50, 60)
  doc.text(uuid, ANCHO - MARGEN, 26, { align: 'right' })

  let y = 36
  doc.setDrawColor(...A).setLineWidth(0.5).line(MARGEN, y, ANCHO - MARGEN, y); y += 6

  // Emisor / Receptor
  const col2 = ANCHO / 2 + 2
  const bloque = (x: number, titulo: string, lineas: string[]) => {
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...A); doc.text(titulo, x, y)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(60, 70, 80)
    lineas.forEach((l, i) => doc.text(l, x, y + 5 + i * 4))
  }
  bloque(MARGEN, 'EMISOR', [
    attr(emisor, 'Nombre'), `RFC: ${reEmisor}`, `Régimen: ${attr(emisor, 'RegimenFiscal')}`,
    `Lugar de expedición: ${attr(comp, 'LugarExpedicion')}`,
  ])
  bloque(col2, 'RECEPTOR', [
    attr(receptor, 'Nombre'), `RFC: ${rrReceptor}`,
    `CP: ${attr(receptor, 'DomicilioFiscalReceptor')} · Régimen: ${attr(receptor, 'RegimenFiscalReceptor')}`,
    `Uso CFDI: ${attr(receptor, 'UsoCFDI')}`,
  ])
  y += 26

  // Metadatos
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(90, 100, 110)
  const serie = attr(comp, 'Serie'), folio = attr(comp, 'Folio')
  doc.text([
    `Fecha: ${attr(comp, 'Fecha')}`,
    serie || folio ? `Serie-Folio: ${serie}${folio ? '-' + folio : ''}` : '',
    `Forma de pago: ${attr(comp, 'FormaPago')} · Método: ${attr(comp, 'MetodoPago')} · Moneda: ${moneda}`,
  ].filter(Boolean).join('     '), MARGEN, y); y += 5

  // Conceptos
  autoTable(doc, {
    startY: y,
    head: [['Clave', 'Cant.', 'Unidad', 'Descripción', 'V. Unitario', 'Importe']],
    body: conceptos.map(c => [
      attr(c as Element, 'ClaveProdServ'), attr(c as Element, 'Cantidad'), attr(c as Element, 'ClaveUnidad'),
      attr(c as Element, 'Descripcion'), money(attr(c as Element, 'ValorUnitario'), moneda), money(attr(c as Element, 'Importe'), moneda),
    ]),
    theme: 'plain', headStyles: { fillColor: A, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [50, 60, 70] }, alternateRowStyles: { fillColor: [246, 249, 251] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 14, halign: 'right' }, 2: { cellWidth: 16 }, 3: { cellWidth: 78 }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    margin: { left: MARGEN, right: MARGEN },
  })
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 6

  // Totales
  const xL = ANCHO - MARGEN - 55, xV = ANCHO - MARGEN
  const fila = (l: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 11 : 9)
    doc.setTextColor(...(bold ? A : [90, 100, 110] as [number, number, number]))
    doc.text(l, xL, y); doc.text(v, xV, y, { align: 'right' }); y += bold ? 7 : 5
  }
  fila('Subtotal', money(subtotal, moneda))
  if (descuento > 0) fila('Descuento', '- ' + money(descuento, moneda))
  fila('IVA', money(iva, moneda))
  doc.setDrawColor(220, 228, 235).line(xL, y - 2, xV, y - 2); y += 2
  fila('Total', money(total, moneda), true)
  y += 4

  // QR + timbre
  const qr = await QRCode.toDataURL(qrTexto, { margin: 1, width: 240 })
  doc.addImage(qr, 'PNG', MARGEN, y, 30, 30)
  const xt = MARGEN + 34
  doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(...A); doc.text('Timbre Fiscal Digital del SAT', xt, y + 3)
  doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(80, 90, 100)
  const info = [
    `Folio fiscal: ${uuid}`,
    `Fecha certificación: ${fechaTimbrado}`,
    `No. certificado SAT: ${noCertSAT}`,
    `No. certificado emisor: ${attr(comp, 'NoCertificado')}`,
    `RFC proveedor certif.: ${rfcPac}`,
  ]
  info.forEach((l, i) => doc.text(l, xt, y + 8 + i * 3.5))
  y += 34

  const sello = (titulo: string, valor: string) => {
    doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(...A); doc.text(titulo, MARGEN, y); y += 3
    doc.setFont('helvetica', 'normal').setFontSize(5.5).setTextColor(120, 130, 140)
    const lineas = doc.splitTextToSize(valor, ANCHO - MARGEN * 2) as string[]
    lineas.slice(0, 6).forEach(l => { doc.text(l, MARGEN, y); y += 2.6 }); y += 2
  }
  sello('Sello digital del CFDI', selloCFD)
  sello('Sello del SAT', selloSAT)
  sello('Cadena original del complemento de certificación digital del SAT', cadena)

  doc.setFont('helvetica', 'italic').setFontSize(6.5).setTextColor(140, 150, 160)
  doc.text('Este documento es una representación impresa de un CFDI 4.0.', MARGEN, Math.min(y + 2, 290))

  return doc
}

export async function descargarCFDI(xmlText: string, marca: MarcaCFDI, uuidFallback = 'factura') {
  const doc = await construirCFDIPDF(xmlText, marca)
  const uuid = (xmlText.match(/UUID="([^"]+)"/)?.[1] || uuidFallback)
  descargarPDF(doc, `CFDI-${uuid}.pdf`)
}
