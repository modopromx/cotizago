// Generación de PDF del lado del cliente (jsPDF).
// Dos documentos: cotización (A4 con logo, marca y QR al enlace público) y
// nota de remisión (comprobante no fiscal para compras fuera de México).
// Los builders son isomórficos (sirven en navegador y en Node para el demo);
// La descarga (solo navegador) vive en ./descarga.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'
import { aFecha } from './utils'

const MARGEN = 15
const ANCHO = 210
const CONTENIDO = ANCHO - MARGEN * 2

function hexToRgb(hex?: string): [number, number, number] {
  const h = (hex ?? '#08AEB6').replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function money(n: number, moneda = 'MXN') {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(Number(n) || 0)
}

function fecha(d?: string) {
  if (!d) return ''
  // aFecha: una fecha sin hora ('AAAA-MM-DD') es ese día local, no medianoche UTC
  // (que en México caía en el día anterior).
  return aFecha(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Descarga una imagen (logo) como data URL. Devuelve null si falla (CORS, 404…).
async function toDataUrl(url?: string): Promise<{ data: string; fmt: string } | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    const ct = res.headers.get('content-type') || 'image/png'
    let bin = ''
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
    const b64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(buf).toString('base64')
    const fmt = ct.includes('png') ? 'PNG' : ct.includes('webp') ? 'WEBP' : 'JPEG'
    return { data: `data:${ct};base64,${b64}`, fmt }
  } catch { return null }
}

export interface EmisorPDF {
  nombre?: string; empresa?: string; telefono?: string; email_empresa?: string
  rfc?: string; direccion?: string; logo_url?: string; color_marca?: string
  banco?: string; titular?: string; clabe?: string; link_pago?: string
}
export interface CotizacionPDFData {
  emisor: EmisorPDF
  cotizacion: any
  items: any[]
  publicUrl?: string
}

export async function buildCotizacionPDF(d: CotizacionPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const c = d.cotizacion
  const em = d.emisor
  const accent = hexToRgb(em.color_marca)
  let y = 16

  // Si el bloque que sigue no cabe en lo que resta de la hoja, salta a una
  // página nueva. Así el contenido de abajo nunca se recorta en cotizaciones
  // grandes; simplemente se generan más páginas.
  const LIMITE = 277 // A4 mide 297 mm; dejamos ~20 mm para el pie
  const nuevaPaginaSi = (alto: number) => { if (y + alto > LIMITE) { doc.addPage(); y = 20 } }

  // Logo o nombre del emisor
  const logo = await toDataUrl(em.logo_url)
  if (logo) {
    try {
      const props = doc.getImageProperties(logo.data)
      const w = 42, h = (props.height / props.width) * w
      doc.addImage(logo.data, logo.fmt, MARGEN, y - 2, w, Math.min(h, 16))
    } catch { doc.setFont('helvetica', 'bold').setFontSize(16).text(em.empresa ?? em.nombre ?? '', MARGEN, y + 4) }
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(15, 33, 59).text(em.empresa ?? em.nombre ?? 'Mi empresa', MARGEN, y + 4)
  }

  // Bloque derecho: COTIZACIÓN + folio + fechas
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...accent)
  doc.text('COTIZACIÓN', ANCHO - MARGEN, y + 2, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90, 100, 110)
  doc.text(String(c.numero ?? ''), ANCHO - MARGEN, y + 9, { align: 'right' })
  doc.text(`Emisión: ${fecha(c.fecha_emision)}`, ANCHO - MARGEN, y + 14, { align: 'right' })
  if (c.fecha_vencimiento) doc.text(`Vigencia: ${fecha(c.fecha_vencimiento)}`, ANCHO - MARGEN, y + 19, { align: 'right' })

  y = 40
  doc.setDrawColor(...accent).setLineWidth(0.6).line(MARGEN, y, ANCHO - MARGEN, y)
  y += 8

  // De / Para
  doc.setFontSize(8).setTextColor(150, 160, 170).setFont('helvetica', 'bold')
  doc.text('DE', MARGEN, y)
  doc.text('PREPARADA PARA', ANCHO / 2, y)
  doc.setFontSize(10).setTextColor(30, 41, 59).setFont('helvetica', 'bold')
  doc.text(em.empresa ?? em.nombre ?? '', MARGEN, y + 5)
  doc.text(c.cliente_nombre || 'Cliente', ANCHO / 2, y + 5)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90, 100, 110)
  const deLines = [em.email_empresa, em.telefono, em.rfc ? `RFC: ${em.rfc}` : ''].filter(Boolean) as string[]
  const paraLines = [
    c.cliente_empresa,
    c.cliente_email,
    c.cliente_whatsapp ? `Tel: ${String(c.cliente_whatsapp).replace(/\D/g, '')}` : '',
    c.cliente_rfc ? `RFC: ${c.cliente_rfc}` : '',
  ].filter(Boolean) as string[]
  deLines.forEach((l, i) => doc.text(l, MARGEN, y + 10 + i * 4.5))
  paraLines.forEach((l, i) => doc.text(l, ANCHO / 2, y + 10 + i * 4.5))
  y += 12 + Math.max(deLines.length, paraLines.length) * 4.5

  // Tabla de conceptos. El título de cada concepto va en NEGRITAS y la
  // descripción debajo en gris; la columna "Cant." incluye la unidad
  // (servicio, horas, pieza…). Si hay descuentos, se muestra la columna "Desc.".
  const hayDesc = (d.items ?? []).some(it => Number(it.descuento_porcentaje) > 0)
  const numCols = hayDesc ? 6 : 5
  // Cada concepto son DOS filas: (1) título en negritas con sus cifras y (2) la
  // descripción en gris a todo lo ancho. Al ser TEXTO REAL de la tabla (no
  // dibujado a mano), autotable la reparte sola entre páginas: no se duplica y
  // no deja huecos, va llenando la hoja. `rowItem` mapea cada fila del cuerpo a
  // su índice de producto, para pintar en zebra el BLOQUE completo (título +
  // descripción) de un producto sí y el siguiente no.
  const body: any[] = []
  const rowItem: number[] = []
  ;(d.items ?? []).forEach((it, idx) => {
    const cant = it.unidad ? `${it.cantidad} ${it.unidad}` : String(it.cantidad)
    const titulo: any[] = [
      { content: it.nombre, styles: { fontStyle: 'bold' } },
      cant,
      money(it.precio_unitario, c.moneda),
    ]
    if (hayDesc) titulo.push(Number(it.descuento_porcentaje) > 0 ? `${it.descuento_porcentaje}%` : '—')
    titulo.push(`${it.iva_porcentaje ?? 0}%`, { content: money(it.subtotal, c.moneda), styles: { fontStyle: 'bold' } })
    body.push(titulo); rowItem.push(idx)
    if (it.descripcion && String(it.descripcion).trim()) {
      body.push([{
        content: String(it.descripcion),
        colSpan: numCols,
        styles: { fontStyle: 'normal', fontSize: 8, textColor: [120, 130, 140], cellPadding: { top: 0.5, right: 2, bottom: 4, left: 2 } },
      }])
      rowItem.push(idx)
    }
  })
  autoTable(doc, {
    startY: y,
    head: [hayDesc
      ? ['Concepto', 'Cant.', 'P. Unit.', 'Desc.', 'IVA', 'Importe']
      : ['Concepto', 'Cant.', 'P. Unit.', 'IVA', 'Importe']],
    body,
    theme: 'plain',
    headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [50, 60, 70], valign: 'top', cellPadding: { top: 2.5, right: 2, bottom: 1, left: 2 } },
    columnStyles: hayDesc
      ? {
          0: { cellWidth: 66 },
          1: { halign: 'left', cellWidth: 24 },
          2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 14 },
          4: { halign: 'right', cellWidth: 14 }, 5: { halign: 'right', cellWidth: 36 },
        }
      : {
          0: { cellWidth: 80 },
          1: { halign: 'left', cellWidth: 24 },
          2: { halign: 'right', cellWidth: 28 }, 3: { halign: 'right', cellWidth: 14 },
          4: { halign: 'right', cellWidth: 34 },
        },
    // Fondo alternado POR PRODUCTO: se colorea el bloque completo (título +
    // descripción) de un concepto sí y el siguiente no, según la paridad del
    // índice del producto (no de la fila), para que las dos filas de un mismo
    // concepto lleven el mismo color y se lean como un solo bloque.
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const idx = rowItem[data.row.index]
        if (idx !== undefined && idx % 2 === 0) data.cell.styles.fillColor = [244, 247, 250]
      }
    },
    // El margen inferior deja aire al pie y el encabezado se repite por página.
    margin: { left: MARGEN, right: MARGEN, top: 20, bottom: 22 },
  })

  // @ts-ignore — lastAutoTable lo agrega el plugin
  y = (doc as any).lastAutoTable.finalY + 8

  // Totales: bloque que no debe partirse. Si no cabe, pasa a la hoja siguiente.
  nuevaPaginaSi(40)
  const xLbl = ANCHO - MARGEN - 60, xVal = ANCHO - MARGEN
  const fila = (l: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 12 : 9.5)
    if (bold) doc.setTextColor(...accent); else doc.setTextColor(90, 100, 110)
    doc.text(l, xLbl, y); doc.text(v, xVal, y, { align: 'right' }); y += bold ? 8 : 6
  }
  fila('Subtotal', money(c.subtotal, c.moneda))
  if (Number(c.descuento_monto) > 0) fila('Descuento', `- ${money(c.descuento_monto, c.moneda)}`)
  fila('Impuestos', money(c.impuestos, c.moneda))
  // Divisor con aire arriba y abajo para que el "Total" (12 pt) no se encime.
  y += 1
  doc.setDrawColor(220, 228, 235).line(xLbl, y - 3, xVal, y - 3)
  y += 4
  fila('Total', money(c.total, c.moneda), true)

  // QR al enlace público (a la izquierda, alineado con los totales)
  if (d.publicUrl) {
    try {
      const qr = await QRCode.toDataURL(d.publicUrl, { margin: 1, width: 220 })
      doc.addImage(qr, 'PNG', MARGEN, y - 22, 24, 24)
      doc.setFontSize(7.5).setTextColor(130, 140, 150).setFont('helvetica', 'normal')
      doc.text('Escanea para ver,', MARGEN + 27, y - 15)
      doc.text('aceptar o rechazar en línea', MARGEN + 27, y - 11)
    } catch { /* sin QR */ }
  }
  y += 4

  // Escribe un párrafo (NOTAS / TÉRMINOS) paginando línea por línea, de modo
  // que un texto muy largo continúe en las páginas siguientes sin cortarse.
  const parrafo = (titulo: string, texto: string) => {
    nuevaPaginaSi(10)
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(150, 160, 170)
    doc.text(titulo, MARGEN, y); y += 4
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90, 100, 110)
    for (const ln of doc.splitTextToSize(texto, CONTENIDO) as string[]) {
      nuevaPaginaSi(5); doc.text(ln, MARGEN, y); y += 4
    }
    y += 3
  }
  if (c.notas || c.terminos) {
    nuevaPaginaSi(8)
    doc.setDrawColor(235, 240, 244).line(MARGEN, y, ANCHO - MARGEN, y); y += 6
    if (c.notas) parrafo('NOTAS', String(c.notas))
    if (c.terminos) parrafo('TÉRMINOS', String(c.terminos))
  }

  // Datos de pago (bloque con recuadro; no debe partirse)
  if (em.banco || em.clabe || em.link_pago) {
    const pay = [
      em.banco && `Banco: ${em.banco}`,
      em.titular && `Titular: ${em.titular}`,
      em.clabe && `CLABE: ${em.clabe}`,
      em.link_pago && `Pago en línea: ${em.link_pago}`,
    ].filter(Boolean) as string[]
    const filas = Math.ceil(pay.length / 2)
    const alto = 12 + filas * 5
    nuevaPaginaSi(alto + 6)
    doc.setFillColor(246, 249, 251).roundedRect(MARGEN, y, CONTENIDO, alto, 2, 2, 'F')
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(120, 130, 140)
    doc.text('DATOS DE PAGO', MARGEN + 4, y + 6)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(70, 80, 90)
    const colX = [MARGEN + 4, MARGEN + CONTENIDO / 2 + 2]
    pay.forEach((l, i) => {
      const col = i % 2, row = Math.floor(i / 2)
      doc.text(l, colX[col], y + 12 + row * 5)
    })
    y += alto + 4
  }

  // Pie + numeración en TODAS las páginas
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5).setTextColor(160, 170, 180).setFont('helvetica', 'normal')
    doc.text('Generado con Cotiza Go', ANCHO / 2, 290, { align: 'center' })
    if (paginas > 1) doc.text(`Página ${p} de ${paginas}`, ANCHO - MARGEN, 290, { align: 'right' })
  }

  return doc
}

export interface NotaRemisionData {
  folio: string
  fecha?: string
  receptor: { nombre?: string; rfc?: string; pais?: string; direccion?: string }
  concepto: string
  monto: number
  moneda?: string
}

export async function buildNotaRemisionPDF(d: NotaRemisionData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const accent = hexToRgb('#08AEB6')
  let y = 18

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(15, 33, 59).text('Cotiza Go', MARGEN, y)
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...accent).text('NOTA DE REMISIÓN', ANCHO - MARGEN, y, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90, 100, 110)
  doc.text('Documento no fiscal', ANCHO - MARGEN, y + 6, { align: 'right' })
  doc.text(`Folio: ${d.folio}`, ANCHO - MARGEN, y + 11, { align: 'right' })
  doc.text(`Fecha: ${fecha(d.fecha ?? new Date().toISOString())}`, ANCHO - MARGEN, y + 16, { align: 'right' })

  y = 42
  doc.setDrawColor(...accent).setLineWidth(0.6).line(MARGEN, y, ANCHO - MARGEN, y); y += 8

  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(150, 160, 170).text('CLIENTE', MARGEN, y)
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(30, 41, 59).text(d.receptor.nombre || 'Cliente', MARGEN, y + 5)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90, 100, 110)
  const rl = [d.receptor.rfc ? `ID fiscal: ${d.receptor.rfc}` : '', d.receptor.pais ? `País: ${d.receptor.pais}` : '', d.receptor.direccion].filter(Boolean) as string[]
  rl.forEach((l, i) => doc.text(l, MARGEN, y + 10 + i * 4.5))
  y += 12 + rl.length * 4.5

  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Importe']],
    body: [[d.concepto, money(d.monto, d.moneda)]],
    theme: 'plain',
    headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 140 }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGEN, right: MARGEN },
  })
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...accent)
  doc.text('Total', ANCHO - MARGEN - 50, y); doc.text(money(d.monto, d.moneda), ANCHO - MARGEN, y, { align: 'right' })

  y += 16
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(120, 130, 140)
  const nota = 'Este documento es una nota de remisión sin validez fiscal, emitida como comprobante de la operación. Consérvala junto con tu comprobante de pago para efectos de deducibilidad conforme a la normativa de tu país.'
  doc.text(doc.splitTextToSize(nota, CONTENIDO), MARGEN, y)

  doc.setFontSize(7.5).setTextColor(160, 170, 180).text('Generado con Cotiza Go', ANCHO / 2, 288, { align: 'center' })
  return doc
}
