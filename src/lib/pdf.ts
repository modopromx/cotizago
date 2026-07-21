// Generación de PDF del lado del cliente (jsPDF).
// Dos documentos: cotización (A4 con logo, marca y QR al enlace público) y
// nota de remisión (comprobante no fiscal para compras fuera de México).
// Los builders son isomórficos (sirven en navegador y en Node para el demo);
// `descargarPDF` es solo de navegador.

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'

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
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
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
  const paraLines = [c.cliente_empresa, c.cliente_email, c.cliente_rfc ? `RFC: ${c.cliente_rfc}` : ''].filter(Boolean) as string[]
  deLines.forEach((l, i) => doc.text(l, MARGEN, y + 10 + i * 4.5))
  paraLines.forEach((l, i) => doc.text(l, ANCHO / 2, y + 10 + i * 4.5))
  y += 12 + Math.max(deLines.length, paraLines.length) * 4.5

  // Tabla de conceptos
  autoTable(doc, {
    startY: y,
    head: [['Concepto', 'Cant.', 'P. Unit.', 'IVA', 'Importe']],
    body: (d.items ?? []).map(it => [
      it.descripcion ? `${it.nombre}\n${it.descripcion}` : it.nombre,
      String(it.cantidad),
      money(it.precio_unitario, c.moneda),
      `${it.iva_porcentaje ?? 0}%`,
      money(it.subtotal, c.moneda),
    ]),
    theme: 'plain',
    headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [50, 60, 70] },
    alternateRowStyles: { fillColor: [246, 249, 251] },
    columnStyles: {
      0: { cellWidth: 92 }, 1: { halign: 'right', cellWidth: 16 },
      2: { halign: 'right', cellWidth: 28 }, 3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
    },
    margin: { left: MARGEN, right: MARGEN },
  })

  // @ts-ignore — lastAutoTable lo agrega el plugin
  y = (doc as any).lastAutoTable.finalY + 8

  // Totales (columna derecha)
  const xLbl = ANCHO - MARGEN - 60, xVal = ANCHO - MARGEN
  const fila = (l: string, v: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 12 : 9.5)
    doc.setTextColor(bold ? accent[0] : 90, bold ? accent[1] : 100, bold ? accent[2] : 110)
    if (bold) doc.setTextColor(...accent)
    doc.text(l, xLbl, y); doc.text(v, xVal, y, { align: 'right' }); y += bold ? 8 : 6
  }
  fila('Subtotal', money(c.subtotal, c.moneda))
  if (Number(c.descuento_monto) > 0) fila('Descuento', `- ${money(c.descuento_monto, c.moneda)}`)
  fila('Impuestos', money(c.impuestos, c.moneda))
  doc.setDrawColor(220, 228, 235).line(xLbl, y - 3, xVal, y - 3)
  fila('Total', money(c.total, c.moneda), true)

  // QR al enlace público
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

  // Notas / términos
  if (c.notas || c.terminos) {
    doc.setDrawColor(235, 240, 244).line(MARGEN, y, ANCHO - MARGEN, y); y += 6
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(150, 160, 170)
    if (c.notas) { doc.text('NOTAS', MARGEN, y); doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90, 100, 110); doc.text(doc.splitTextToSize(c.notas, CONTENIDO), MARGEN, y + 4); y += 4 + doc.splitTextToSize(c.notas, CONTENIDO).length * 4 + 3 }
    if (c.terminos) { doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(150, 160, 170); doc.text('TÉRMINOS', MARGEN, y); doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90, 100, 110); doc.text(doc.splitTextToSize(c.terminos, CONTENIDO), MARGEN, y + 4); y += 4 + doc.splitTextToSize(c.terminos, CONTENIDO).length * 4 + 3 }
  }

  // Datos de pago
  if (em.banco || em.clabe || em.link_pago) {
    doc.setFillColor(246, 249, 251).roundedRect(MARGEN, y, CONTENIDO, 20, 2, 2, 'F')
    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(120, 130, 140)
    doc.text('DATOS DE PAGO', MARGEN + 4, y + 6)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(70, 80, 90)
    const pay = [em.banco && `Banco: ${em.banco}`, em.titular && `Titular: ${em.titular}`, em.clabe && `CLABE: ${em.clabe}`, em.link_pago && `Pago en línea: ${em.link_pago}`].filter(Boolean) as string[]
    pay.forEach((l, i) => doc.text(l, MARGEN + 4, y + 11 + (i % 2) * 4.5 + Math.floor(i / 2) * 0))
    y += 24
  }

  // Pie
  doc.setFontSize(7.5).setTextColor(160, 170, 180).setFont('helvetica', 'normal')
  doc.text('Generado con Cotiza Go', ANCHO / 2, 288, { align: 'center' })

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

// Helper de navegador: dispara la descarga del PDF.
export function descargarPDF(doc: jsPDF, filename: string) {
  doc.save(filename)
}
