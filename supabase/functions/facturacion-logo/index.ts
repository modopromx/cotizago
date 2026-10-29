// RETIRADA (29-oct-2026). Subía el logo de una empresa de facturación protegida
// solo con una contraseña fija escrita en el código: quien la viera podía cambiar
// el logo de cualquier marca. El panel de admin sube el logo directo al bucket
// 'logos' con la sesión del superadmin, así que esta función ya no se usa.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  return new Response(JSON.stringify({ error: 'Servicio retirado. Sube el logo desde el panel de administración.' }), {
    status: 410, headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
