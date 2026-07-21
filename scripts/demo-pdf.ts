// Demo: genera PDFs de ejemplo con el mismo generador que usa la app.
// Uso: npx tsx scripts/demo-pdf.ts
import { writeFileSync } from 'node:fs'
import { buildCotizacionPDF, buildNotaRemisionPDF } from '../src/lib/pdf'

const emisor = {
  nombre: 'Alan Velázquez', empresa: 'Áurea Visual Studio',
  email_empresa: 'contacto@aureavisual.mx', telefono: '+52 55 1234 5678',
  rfc: 'AUV260120XX1', color_marca: '#08AEB6',
  banco: 'BBVA', titular: 'Áurea Visual Studio SA de CV', clabe: '012180001234567890',
  link_pago: 'https://pago.clip.mx/aurea',
}

const cotizacion = {
  numero: 'CTZ-0027', fecha_emision: new Date().toISOString(),
  fecha_vencimiento: new Date(Date.now() + 15 * 864e5).toISOString(),
  cliente_nombre: 'Mariana López', cliente_empresa: 'Constructora Áurea S.A. de C.V.',
  cliente_email: 'compras@aurea.mx', cliente_rfc: 'CAU210101AB2',
  subtotal: 18450, descuento_monto: 0, impuestos: 2952, total: 21402, moneda: 'MXN',
  notas: 'Los tiempos de entrega se confirman al recibir el anticipo.',
  terminos: '50% de anticipo y 50% contra entrega. Vigencia de la propuesta: 15 días naturales.',
}

const items = [
  { nombre: 'Diseño de sitio web corporativo', descripcion: 'Diseño UX/UI, desarrollo responsivo y optimización', cantidad: 1, precio_unitario: 14500, iva_porcentaje: 16, subtotal: 14500 },
  { nombre: 'Configuración de analítica', descripcion: 'Panel de métricas y eventos de conversión', cantidad: 1, precio_unitario: 3950, iva_porcentaje: 16, subtotal: 3950 },
]

const run = async () => {
  const cot = await buildCotizacionPDF({
    emisor, cotizacion, items,
    publicUrl: 'https://cotiza.go/c/demo-token-abc123',
  })
  writeFileSync('demo/cotizacion-ejemplo.pdf', Buffer.from(cot.output('arraybuffer')))

  const nota = await buildNotaRemisionPDF({
    folio: 'NR-10842', receptor: { nombre: 'Global Ventures LLC', rfc: 'EIN 88-1234567', pais: 'Estados Unidos' },
    concepto: 'Paquete Negocio · 100 folios Cotiza Go', monto: 499, moneda: 'MXN',
  })
  writeFileSync('demo/nota-remision-ejemplo.pdf', Buffer.from(nota.output('arraybuffer')))

  console.log('✓ Generados: demo/cotizacion-ejemplo.pdf y demo/nota-remision-ejemplo.pdf')
}
run().catch(e => { console.error(e); process.exit(1) })
