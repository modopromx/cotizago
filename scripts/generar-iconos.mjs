// Genera los iconos PNG de la PWA a partir del SVG de marca.
//
// Hacen falta PNG porque:
//  - iOS ignora por completo los apple-touch-icon en SVG (saldria en blanco).
//  - Chrome pide 192 y 512 en PNG para ofrecer "Instalar aplicacion".
//  - El icono "maskable" de Android se recorta en circulo/squircle, asi que su
//    contenido va dentro de la zona segura (80%) y el fondo llega a los bordes.
//
// Uso: node scripts/generar-iconos.mjs
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const FONDO_A = '#06213B'
const FONDO_B = '#0B6DAD'

// El dibujo de la marca, sin fondo, en un lienzo de 512.
const marca = `
  <g transform="translate(146 116) scale(1.72)">
    <path d="M8 14 Q8 4 18 4 L70 4 L102 36 L102 116 Q102 126 92 126 L18 126 Q8 126 8 116 Z"
      fill="url(#doc)" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/>
    <path d="M70 4 L70 36 L102 36" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/>
    <polyline points="22,96 37,70 52,82 68,54" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="68" y1="54" x2="86" y2="54" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
    <polyline points="79,45 88,54 79,63" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${FONDO_A}"/><stop offset="100%" stop-color="${FONDO_B}"/>
    </linearGradient>
    <linearGradient id="doc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#17C5C9"/><stop offset="55%" stop-color="${FONDO_B}"/>
      <stop offset="100%" stop-color="${FONDO_A}"/>
    </linearGradient>
  </defs>`

// radio: esquinas redondeadas (0 = cuadrado completo)
// escala: cuanto se encoge la marca respecto al lienzo
const svg = (radio, escala) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${defs}
  <rect width="512" height="512" rx="${radio}" fill="url(#bg)"/>
  <g transform="translate(${256 * (1 - escala)} ${256 * (1 - escala)}) scale(${escala})">${marca}</g>
</svg>`

const salidas = [
  // Icono normal: esquinas redondeadas propias.
  { archivo: 'public/pwa-192x192.png', tam: 192, svg: svg(112, 1) },
  { archivo: 'public/pwa-512x512.png', tam: 512, svg: svg(112, 1) },
  // Maskable: fondo a sangre y marca dentro de la zona segura.
  { archivo: 'public/pwa-maskable-512x512.png', tam: 512, svg: svg(0, 0.72) },
  // iOS aplica su propia mascara: fondo cuadrado, sin transparencia.
  { archivo: 'public/apple-touch-icon.png', tam: 180, svg: svg(0, 0.86) },
  // Favicon PNG de respaldo para navegadores viejos.
  { archivo: 'public/favicon-32x32.png', tam: 32, svg: svg(64, 1) },
]

for (const s of salidas) {
  const png = await sharp(Buffer.from(s.svg)).resize(s.tam, s.tam).png().toBuffer()
  await writeFile(s.archivo, png)
  console.log(`${s.archivo}  ${s.tam}x${s.tam}  ${(png.length / 1024).toFixed(1)} KB`)
}
