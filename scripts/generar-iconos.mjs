// Genera los iconos PNG de la PWA y el favicon a partir del ICONO oficial
// (símbolo C/G sobre fondo blanco). El logo con letras se usa dentro de la app
// (public/cotiza-go-logo.png); para el ícono cuadrado de app/favicon va solo el
// símbolo, que es lo que se lee bien en tamaños chicos.
//
//  - iOS ignora los apple-touch-icon en SVG (por eso PNG).
//  - Chrome pide 192 y 512 en PNG para ofrecer "Instalar aplicación".
//  - El "maskable" de Android se recorta en círculo/squircle: fondo a sangre.
//
// Uso: node scripts/generar-iconos.mjs
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'

const ICONO = await readFile('scripts/icono.png')   // símbolo C/G, fondo blanco

// Máscara de esquinas redondeadas (blanco dentro, transparente fuera).
const mascara = (tam, radio) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}">
     <rect width="${tam}" height="${tam}" rx="${radio}" fill="#fff"/>
   </svg>`
)

// Icono cuadrado con fondo blanco; radio = esquinas redondeadas (0 = cuadrado).
async function icono(tam, radio) {
  // Se aplana sobre blanco por si el PNG trae algún borde no-opaco.
  const base = await sharp(ICONO).flatten({ background: '#ffffff' }).resize(tam, tam).png().toBuffer()
  if (radio === 0) return base
  return sharp(base).composite([{ input: mascara(tam, radio), blend: 'dest-in' }]).png().toBuffer()
}

const salidas = [
  // Icono normal (purpose "any"): esquinas redondeadas propias.
  { archivo: 'public/pwa-192x192.png', tam: 192, radio: 42 },
  { archivo: 'public/pwa-512x512.png', tam: 512, radio: 112 },
  // Maskable: fondo blanco a sangre (Android aplica su propio recorte).
  { archivo: 'public/pwa-maskable-512x512.png', tam: 512, radio: 0 },
  // iOS aplica su propia máscara: fondo cuadrado, sin transparencia.
  { archivo: 'public/apple-touch-icon.png', tam: 180, radio: 0 },
  // Favicon de la pestaña del navegador.
  { archivo: 'public/favicon-32x32.png', tam: 32, radio: 6 },
]

for (const s of salidas) {
  const png = await icono(s.tam, s.radio)
  await writeFile(s.archivo, png)
  console.log(`${s.archivo}  ${s.tam}x${s.tam}  ${(png.length / 1024).toFixed(1)} KB`)
}
