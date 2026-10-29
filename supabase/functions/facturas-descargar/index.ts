// RETIRADA (29-oct-2026). Firmaba enlaces de descarga del bucket privado
// 'facturas' con solo el UUID y SIN sesión: quien conociera el folio fiscal de una
// factura (el cliente, el SAT, cualquiera que viera el PDF) bajaba PDF y XML.
// Nadie la usaba: el portal /facturar y facturacion-api ya entregan sus enlaces
// firmados después de comprobar al dueño.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  return new Response(JSON.stringify({ error: 'Servicio retirado. Descarga tu factura desde tu cuenta.' }), {
    status: 410, headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
