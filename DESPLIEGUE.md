# Despliegue de Cotiza Go en Hostinger — cotizago.com.mx

Guía completa. El orden importa: varios pasos dependen de que el anterior esté
hecho.

---

## 1. Hostinger — dominio y SSL

1. **hPanel → Dominios** → apunta `cotizago.com.mx` a la carpeta `public_html`.
2. **hPanel → Seguridad → SSL** → instala el certificado gratuito (Let's Encrypt)
   y activa **"Forzar HTTPS"**.

> **Esto no es opcional.** Sin HTTPS el navegador no registra el service worker,
> así que **la PWA no se instala** ni funciona sin conexión. Tampoco carga el
> checkout de Stripe.

3. Espera a que `https://cotizago.com.mx` cargue con el candado antes de seguir.

---

## 2. Variables de entorno

Crea el archivo `.env` en la raíz del proyecto (no se sube al servidor; solo se
usa al compilar):

```
VITE_SUPABASE_URL=https://mhvbsyacicntniapishp.supabase.co
VITE_SUPABASE_ANON_KEY=<la anon key del proyecto>
```

La anon key está en Supabase → Project Settings → API Keys → `anon` / `public`.
Es pública por diseño: la protección real la dan las políticas RLS.

**Ya no se usan** `VITE_ADMIN_EMAILS` (ahora manda `profiles.is_admin`) ni
`VITE_STRIPE_PUBLISHABLE_KEY` (se configura desde el panel superadmin).

---

## 3. Compilar

```bash
npm install
npm run build
```

Genera la carpeta `dist/`. Las variables del `.env` quedan **incrustadas en el
código compilado**: si cambias una, hay que volver a compilar y volver a subir.

---

## 4. Subir a Hostinger

Sube **el contenido de `dist/`**, no la carpeta, dentro de `public_html`.
Debe quedar así:

```
public_html/
├── .htaccess          ← archivo OCULTO, imprescindible
├── index.html
├── manifest.webmanifest
├── sw.js
├── assets/
└── (iconos png y svg)
```

> ⚠️ **El `.htaccess` es un archivo oculto.** El Administrador de archivos de
> Hostinger no lo muestra si no activas *Configuración → Mostrar archivos
> ocultos*. Sin él, entrar directo a `cotizago.com.mx/app/clientes` o recargar
> esa página devuelve **404**, porque Apache busca una carpeta que no existe.

Si subes por FTP, activa también la opción de mostrar/transferir archivos ocultos.

**En cada actualización:** borra el contenido anterior de `public_html` antes de
subir el nuevo. Los archivos de `assets/` llevan un hash distinto en cada
compilación y se van acumulando.

---

## 5. Supabase — URLs de autenticación

**Authentication → URL Configuration:**

- **Site URL:** `https://cotizago.com.mx`
- **Redirect URLs:** `https://cotizago.com.mx/**`

Sin esto, los correos de confirmación y de recuperación de contraseña apuntan a
`localhost` y el usuario no puede entrar.

**Authentication → Policies:** activa **Leaked password protection**. Rechaza
contraseñas que ya aparecieron en filtraciones conocidas.

---

## 6. Stripe — pasar a producción

El orden importa: **si cambias el modo antes de cargar las llaves, nadie puede
comprar.**

### 6.1 Crear el endpoint de producción

En Stripe, con el interruptor de **modo prueba APAGADO**:

**Developers → Webhooks → Add endpoint**

- URL: `https://mhvbsyacicntniapishp.supabase.co/functions/v1/stripe-webhook`
- Eventos:
  - `checkout.session.completed` — alta de folios y de módulos
  - `invoice.payment_succeeded` — renovación mensual cobrada
  - `invoice.payment_failed` — tarjeta rechazada
  - `customer.subscription.updated` — cambio de estado o cancelación programada
  - `customer.subscription.deleted` — baja definitiva

> **No agregues `invoice.paid`.** Es equivalente a `invoice.payment_succeeded` y
> registraría el mismo cobro dos veces.

Al crearlo, Stripe muestra el **Signing secret** (`whsec_...`). Cópialo.

### 6.2 Cargar las llaves

En **Cotiza Go → Superadmin → Configuración global → Pagos**:

1. Selecciona la pestaña **Producción**.
2. Pega las tres: `pk_live_...`, `sk_live_...` y el `whsec_...` del paso anterior.
3. **Guardar**. La pestaña debe pasar de "Vacía" a **"Lista"**.

### 6.3 Recién ahora, cambiar el modo

Con la pestaña Producción en "Lista", deja seleccionado **Producción** y guarda.
A partir de ese momento los cobros son reales.

> La llave secreta se guarda en una bóveda que **ni tú puedes volver a leer**:
> solo las funciones del servidor la usan. Si la pierdes, se genera otra en Stripe.

### 6.4 Primera compra real

Haz una compra del paquete más barato con una tarjeta real y verifica que los
folios se acrediten. Luego reembólsala desde Stripe si quieres.

---

## 7. Correos — Resend

Los correos (cotización enviada, recarga exitosa, avisos de folios) **no salen**
hasta cargar la API key.

1. Crea una cuenta en resend.com y **verifica el dominio** `cotizago.com.mx`
   (te pide agregar unos registros DNS en Hostinger).
2. Genera una API key.
3. Pégala en **Superadmin → Configuración global → Notificaciones**.
4. En esa misma pantalla configura el remitente, por ejemplo
   `no-reply@cotizago.com.mx`.

Sin dominio verificado, Resend solo deja enviar a tu propio correo.

---

## 8. WhatsApp — Walinker (opcional)

Ya está integrado. En **Superadmin → Configuración global → WhatsApp**:

- API key de Walinker
- Token del webhook (invéntalo, algo largo)
- Registra en Walinker la URL del webhook que aparece en esa pantalla

Si no lo configuras, los envíos por WhatsApp usan `wa.me` normal, que funciona
igual pero sin link de marca ni estadísticas.

---

## Lista de verificación final

- [ ] `https://cotizago.com.mx` carga con candado
- [ ] Recargar `https://cotizago.com.mx/app/cotizaciones` **no** da 404
- [ ] El navegador ofrece "Instalar aplicación"
- [ ] En iPhone: Compartir → Añadir a inicio muestra el ícono correcto
- [ ] Registrar un usuario nuevo y recibir el correo de confirmación
- [ ] Crear una cotización y descargar su PDF
- [ ] Comprar el paquete más barato con tarjeta real y ver los folios acreditados
- [ ] El cobro aparece en Superadmin → Pagos y cobros

---

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| 404 al recargar cualquier ruta | Falta el `.htaccess` (archivo oculto) |
| No aparece "Instalar aplicación" | Falta HTTPS, o el `.htaccess` está cacheando `sw.js` |
| Los cambios no se ven tras actualizar | El navegador conserva el service worker viejo: Ctrl+Shift+R |
| "Stripe no configurado en modo Producción" | Falta la llave secreta live en la bóveda |
| El cobro se hace pero no se acreditan folios | El webhook no tiene los eventos, o el `whsec` no corresponde al modo |
| Los correos no llegan | Falta la API key de Resend o el dominio no está verificado |
