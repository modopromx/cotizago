# Auditoría técnica de interfaz ($impeccable audit) — 28-oct-2026

**Puntuación: 8/20 (Deficiente).** Accesibilidad 1 · Rendimiento 1 · Responsive 2 · Theming 2 · Integridad 2.
Detector: 12 hallazgos, 10 falsos positivos (hover:bg-* en botones de ícono), 2 ciertos (Inter, gradient-text con #00D0A4 fuera de paleta).

## P0
1. **CotizacionPublicaPage.tsx:36-41** — `responder_cotizacion` ignora `{error}` y marca «¡Respuesta registrada!» aunque falle; botones sin estado de carga (doble toque) y «Rechazar» sin confirmación. → `$impeccable harden`
2. **Rendimiento** — App.tsx importa las 45 páginas de forma estática (0 `import()`); index.html precarga charts y pdf; `@stripe/stripe-js` inyecta Stripe.js (1.15 MB) en `/` y `/registro`; ~200 banderas SVG (`import * as` en CampoTelefono/SelectorIdioma); los 4 idiomas de i18n.ts en el bundle. Landing ≈ 2.3 MB JS / 654 KB gzip. → `$impeccable optimize` (React.lazy por ruta, `@stripe/stripe-js/pure` solo en Folios/Módulos, banderas una por una, idiomas bajo demanda; meta < 150 KB gzip en la landing)

## P1
1. 116 `<label>` sin `htmlFor`, 0 campos ligados (WCAG 1.3.1/4.1.2) → componente `<Campo>`.
2. `.btn-primary` blanco sobre #08AEB6 = 2.71:1; `text-primary-500` también → usar `primary-700` (#0a7176) o texto navy.
3. `text-slate-400` (2.56:1) en 280 usos con información real; 140 textos de 10-11 px → mínimo `slate-500`.
4. Botones de solo ícono sin `aria-label` (menús, ojo de contraseña, eliminar); 20 overlays sin `role="dialog"` ni manejo de foco → componente `<Modal>`.
5. FacturarPage: error arriba fuera de vista en celular (sin `role="alert"`), «Uso del CFDI» es un div con look de input, RFC solo en mayúsculas por CSS, CP sin `inputMode`.
6. Campos a 14 px → zoom forzado en iPhone (`.input` text-sm) → `text-base sm:text-sm`.
7. RegisterPage `grid-cols-2` a 375 px (correo cortado en 134 px) → una columna en móvil + `autoComplete`.
8. CotizacionesPage: 9 botones de ~26 px en tabla con scroll horizontal → tarjetas con acción principal en `<md`.

## P2
Fuente con `@import` y 6 pesos · animaciones sin `prefers-reduced-motion` (marquee, teléfono, anillos) · monto del hero desborda a 375 px · `h-screen` y sin safe-area (barra «Guardar y enviar») · hamburguesa 24 px sin `aria-expanded` · 83 hex fuera de tokens (sidebar, #1e7363, #00D0A4) · color de marca del emisor sin control de contraste en la cotización pública · landing sin `<main>`, `type=number` sin `inputMode` y `|| 0` que impide borrar.

## P3
Botón falso en la maqueta del hero · español fijo en cotización pública/Facturar/video y `/ayuda` con `<ul>` · spinners sin `role="status"`, logo sin width/height.

## Orden recomendado
optimize (P0) → harden cotización pública + Facturar (P0) → harden formularios/modales (P1) → colorize contraste (P1) → adapt móvil (P1) → animate (P2) → optimize fuente (P2) → clarify i18n (P3) → polish.
