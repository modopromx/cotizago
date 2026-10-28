# Auditoría de código CotizaGo — 28-oct-2026

Revisión de 6 frentes (sitio, funciones del repo, facturación desplegada, base de datos, pagos, errores de la app) con verificación adversarial por hallazgo. Detalle completo (escenario, arreglo, veredicto) en `auditoria-2026-10-28-codigo.json`.

## YA ARREGLADO el 28-oct
- Funciones facturacion / facturacion-pdf / facturacion-enviar ahora SOLO internas (x-cg-interna). facturacion-seed y facturacion-csd retiradas (410).
- facturacion-webhook: firma de WooCommerce obligatoria (hallazgo #1).
- Trigger proteger_cotizacion: el navegador no puede marcar enviada/consumir folio ni cambiar user_id (hallazgos de folios gratis y folios de otra cuenta).
- acreditar_referido solo service_role; aplicar_referido/modulo_activo sin anon; search_path fijo.
- Recuperación de contraseña (/recuperar, /nueva-contrasena).

## Hallazgos confirmados (incluye los ya arreglados)

1. **[CRITICA]** (facturacion-desplegada) El webhook de WooCommerce acepta peticiones sin firma y devuelve el token de pedidos ajenos — `facturacion-webhook/index.ts: if (app.woo_webhook_secret && sig) { ... }`
2. **[CRITICA]** (facturacion-desplegada) resolver_pedido permite facturar o descargar el pedido de cualquier cliente con solo el número — `facturar/index.ts: accion === 'resolver_pedido' (y después las acciones buscar/timbrar)`
3. **[ALTA]** (sitio-seguridad) Se pueden publicar y mandar cotizaciones sin gastar folios: el cliente escribe folio_consumido y estado él mismo — `tabla public.cotizaciones (permisos de columna INSERT/UPDATE para authenticated + política cotizaciones_ws); RPC enviar_cotizacion; src/pages/app/NuevaCotizacio`
4. **[ALTA]** (sitio-seguridad) cotizaciones.user_id lo escribe el cliente: se pueden gastar los folios de otra cuenta y mostrar su CLABE en el enlace público — `tabla public.cotizaciones (columna user_id con permiso de INSERT/UPDATE); RPC enviar_cotizacion; RPC get_cotizacion_publica`
5. **[ALTA]** (sitio-seguridad) enviar-email funciona como relevo de phishing: cualquier cuenta gratis manda cualquier plantilla a cualquier correo con HTML inyectado desde el dominio de CotizaGo — `edge function enviar-email (versión desplegada 2, igual a supabase/functions/enviar-email/index.ts); la llaman src/lib/envios.ts y src/pages/auth/RegisterPage.t`
6. **[ALTA]** (sitio-seguridad) Portal /facturar: con el # de pedido (secuencial) se obtienen los datos fiscales de otros compradores y se puede timbrar su compra con otro RFC — `edge function facturar (verify_jwt=false), acciones resolver_pedido / buscar / timbrar; src/pages/public/FacturarPage.tsx:108-136`
7. **[ALTA]** (funciones-repo) enviar-email permite a cualquier cuenta gratuita mandar correos de phishing desde el dominio de la plataforma a quien quiera — `supabase/functions/enviar-email/index.ts:32-90 (desplegada v2, idéntica al repo)`
8. **[ALTA]** (funciones-repo) api-cotizaciones: carrera en el descuento de folios, varias cotizaciones por 1 folio — `supabase/functions/api-cotizaciones/index.ts:52-53 y 114-118 (desplegada v4, idéntica)`
9. **[ALTA]** (facturacion-desplegada) Doble timbrado: dos peticiones simultáneas generan dos CFDI vigentes del mismo facturable — `facturar/index.ts acción timbrar; facturacion-api/index.ts acción timbrar; facturacion/index.ts (Idempotency-Key = crypto.randomUUID())`
10. **[ALTA]** (base-de-datos) El cobro de folios se salta con un UPDATE directo a cotizaciones — `tabla public.cotizaciones (grant UPDATE/INSERT de todas las columnas a authenticated + política cotizaciones_ws) frente a enviar_cotizacion() y get_cotizacion_p`
11. **[ALTA]** (base-de-datos) user_id de la cotización es libre y enviar_cotizacion descuenta folios a otro usuario — `public.enviar_cotizacion(uuid) y public.get_cotizacion_publica(text); política cotizaciones_ws (WITH CHECK solo valida workspace_id)`
12. **[ALTA]** (pagos-negocio) Se puede publicar y compartir una cotización sin gastar folio (la escritura directa en la tabla salta enviar_cotizacion) — `tabla public.cotizaciones (política cotizaciones_ws FOR ALL + GRANT UPDATE/INSERT completo a authenticated) / RPC get_cotizacion_publica / enviar_cotizacion`
13. **[ALTA]** (pagos-negocio) Se acreditan folios y se activan módulos aunque el pago no esté cobrado (no se revisa payment_status; los pagos diferidos como OXXO entran gratis) — `stripe-webhook (v12), case 'checkout.session.completed', las dos ramas (mode payment y mode subscription); create-checkout no limita payment_method_types`
14. **[ALTA]** (app-errores) La vista pública de la cotización se cae en blanco cuando el emisor no tiene logo y su nombre de empresa es '' — `src/pages/public/CotizacionPublicaPage.tsx:79 `(profile?.empresa ?? profile?.nombre ?? 'C')[0].toUpperCase()` + src/pages/auth/RegisterPage.tsx:52 y 63`
15. **[ALTA]** (app-errores) Todas las fechas de la cotización salen un día antes (pantalla, lista, PDF y correo) — `src/lib/utils.ts:15-22 (formatDate) y src/lib/pdf.ts:24-27 (fecha)`
16. **[MEDIA]** (sitio-seguridad) Bloquear a un usuario desde el admin no hace nada: profiles.activo no se revisa en ningún lado — `RPC admin_bloquear_usuario; funciones is_workspace_member / is_admin; src/App.tsx ProtectedRoute; src/context/AuthContext.tsx`
17. **[MEDIA]** (sitio-seguridad) verificar_duplicado ejecutable por anon: permite saber si un email, teléfono o nombre es cliente de CotizaGo — `RPC public.verificar_duplicado (SECURITY DEFINER, EXECUTE para anon); src/pages/auth/RegisterPage.tsx:44`
18. **[MEDIA]** (funciones-repo) stripe-webhook acredita folios en checkout.session.completed sin comprobar payment_status (pagos diferidos como OXXO o SPEI) — `stripe-webhook (desplegada v12), rama checkout.session.completed sin mode=subscription; create-checkout v5 (sesión sin payment_method_types)`
19. **[MEDIA]** (funciones-repo) stripe-webhook responde 200 aunque falle la acreditación de folios: el pago se pierde sin reintento — `stripe-webhook (desplegada v12): `await admin.from('pagos').update(...)` y `await admin.rpc('acreditar_folios', ...)` dentro de checkout.session.completed`
20. **[MEDIA]** (funciones-repo) create-subscription permite crear dos suscripciones de Stripe del mismo módulo; la primera queda cobrando y no se puede cancelar desde la app — `supabase/functions/create-subscription/index.ts:43-48 y 81-102; stripe-webhook upsert onConflict 'workspace_id,clave'`
21. **[MEDIA]** (funciones-repo) api_keys: la política RLS no ata user_id a auth.uid(), así que se puede crear una llave que gasta los folios de otro usuario — `política RLS public.api_keys 'api_keys_ws' (with_check = is_workspace_member(workspace_id)) + api-cotizaciones/index.ts:35-36, 52, 114-115`
22. **[MEDIA]** (funciones-repo) contacto: formulario público sin límite de envíos; agota la cuota SMTP que comparten los correos transaccionales — `supabase/functions/contacto/index.ts:17-63 (desplegada v2, verify_jwt=false)`
23. **[MEDIA]** (facturacion-desplegada) facturas-descargar firma cualquier archivo del bucket privado sin autenticación — `facturas-descargar/index.ts: createSignedUrl(`${uuid}.${ext}`)`
24. **[MEDIA]** (facturacion-desplegada) Sin unicidad en facturables: reintentos crean duplicados y luego cada llamada crea otro — `Tabla facturables (solo hay únicos en id y token); facturacion-webhook, facturar resolver_pedido y facturar-pago usan .maybeSingle() para ver si ya existe`
25. **[MEDIA]** (facturacion-desplegada) facturar-pago genera facturables de pagos no aprobados — `facturar-pago/index.ts: select('*') de pagos sin filtrar estado/acreditado`
26. **[MEDIA]** (facturacion-desplegada) Ventas en USD se timbran como MXN con tipo de cambio 1 — `facturacion-api (acepta moneda 'USD'), facturacion-webhook y resolver_pedido (moneda = order.currency); facturacion/index.ts construirCFDI fija moneda:'MXN', ti`
27. **[MEDIA]** (base-de-datos) verificar_duplicado lo ejecuta anon y deja averiguar si un correo, nombre o teléfono está registrado — `public.verificar_duplicado(uuid, text, text, text): SECURITY DEFINER con EXECUTE para anon`
28. **[MEDIA]** (base-de-datos) Bloquear a un usuario (admin_bloquear_usuario) no le quita ningún acceso — `public.admin_bloquear_usuario(uuid, boolean) → profiles.activo; public.is_workspace_member(uuid); todas las políticas *_ws`
29. **[MEDIA]** (pagos-negocio) Reembolsos y contracargos no quitan folios, bonos de referido ni módulos — `stripe-webhook (v12): no maneja charge.refunded, charge.dispute.created/closed ni refund.*`
30. **[MEDIA]** (pagos-negocio) Si acreditar_folios falla, el webhook responde 200 y Stripe ya no reintenta: el cliente pagó y no recibe sus folios — `stripe-webhook (v12), case 'checkout.session.completed': await admin.rpc('acreditar_folios', ...) y admin.from('pagos').update(...) sin revisar error`
31. **[MEDIA]** (pagos-negocio) Un módulo con el cobro fallido sigue funcionando sin pagar ('morosa' cuenta como activa y puede quedarse así para siempre) — `SQL modulo_activo (estado in ('activa','morosa')); stripe-webhook estadoDesdeStripe ('past_due'/'unpaid' → 'morosa'); invoice.payment_failed`
32. **[MEDIA]** (app-errores) En la vista pública, el cliente puede «aceptar» una cotización cancelada o vencida y la pantalla le dice que sí quedó — `src/pages/public/CotizacionPublicaPage.tsx:36-41 (handleRespuesta) y :207 (condición de los botones) + función SQL responder_cotizacion`
33. **[MEDIA]** (app-errores) Plantillas: 5 de 6 cuentas no tienen ninguna y la página sale vacía; las de correo, «aceptada» y «recordatorio» no se usan nunca — `src/pages/app/PlantillasPage.tsx:35-41 + función SQL handle_new_user + src/lib/envios.ts:22 y ModalEnviarCotizacion.tsx:31`
34. **[MEDIA]** (app-errores) La moneda, el IVA, la vigencia y las condiciones por defecto de Configuración no se aplican a las cotizaciones nuevas — `src/pages/app/ConfiguracionPage.tsx:205-221 vs src/pages/app/NuevaCotizacionPage.tsx:13 y :30-36`
35. **[MEDIA]** (app-errores) El botón «Ver» del dueño marca la cotización como «Vista» y suma visitas falsas — `src/pages/app/CotizacionesPage.tsx:76-79 (handleVer) + src/pages/public/CotizacionPublicaPage.tsx:29 (registrar_vista)`
36. **[MEDIA]** (app-errores) El dashboard suma cotizaciones en USD y COP como si fueran pesos mexicanos — `src/pages/app/DashboardPage.tsx:45-46, 79, 131 y 264`
37. **[MEDIA]** (app-errores) Productos: si se borra el precio, «Producto creado» aparece aunque no se guarda nada (errores sin revisar en productos y clientes) — `src/pages/app/ProductosPage.tsx:44-52 y :60-61; src/pages/app/ClientesPage.tsx:53-63`
38. **[BAJA]** (funciones-repo) walinker-webhook está abierto: el token no está configurado y se puede escribir en cotizaciones de cualquier usuario — `supabase/functions/walinker-webhook/index.ts:15-21 y 32-44 (desplegada v1, verify_jwt=false)`
39. **[BAJA]** (facturacion-desplegada) facturacion-logo protegido solo con una contraseña fija en el código — `facturacion-logo/index.ts: const GUARD = 'cg2026logo'`
40. **[BAJA]** (facturacion-desplegada) Los datos fiscales guardados se buscan con ILIKE sin escapar comodines — `facturar/index.ts: receptorDe() → .ilike('email', f.cliente_email)`
41. **[BAJA]** (base-de-datos) Contraseña SMTP y secretos de integraciones legibles en texto plano por cualquier miembro — `tablas public.email_conexiones (columna password) y public.integraciones (columna secreto); políticas email_conn_ws / integraciones_ws (ALL para is_workspace_me`
42. **[BAJA]** (pagos-negocio) Pagar dos veces el mismo módulo crea dos suscripciones en Stripe; la base solo guarda una y la otra cobra cada mes sin que se pueda cancelar desde el panel — `create-subscription (v1): la revisión 'yaTiene' ocurre al crear la sesión, no al pagar; stripe-webhook upsert onConflict 'workspace_id,clave' en checkout.sessio`
43. **[BAJA]** (pagos-negocio) Programa de referidos explotable con cuentas propias: duplica los folios por compra y no tiene tope — `SQL aplicar_referido / acreditar_referido; RegisterPage.tsx:74`
44. **[BAJA]** (pagos-negocio) El webhook acepta eventos de prueba (tarjeta 4242) y acredita folios reales: no compara el modo del evento con el del pago — `stripe-webhook (v12): candidatos test+live y acreditar_folios sin revisar pagos.metadata.modo; config_plataforma.stripe_modo`
45. **[BAJA]** (app-errores) Al crear una cotización, si falla el guardado de los conceptos, queda guardada sin conceptos y se ofrece enviarla — `src/pages/app/NuevaCotizacionPage.tsx:118-120 (insert de cotizacion_items) y :89 (generate_cotizacion_number)`
46. **[BAJA]** (app-errores) «Duplicar» copia la fecha de emisión vieja y datos de pago y visita de la cotización original — `src/pages/app/CotizacionesPage.tsx:131-139 (handleDuplicar)`

## Severidad baja sin verificar

- El 'Pagar en línea' del enlace público usa link_pago sin validar el esquema (javascript:); solo lo frena el CSP
- walinker-link escribe wa_link en cualquier cotización por id (IDOR) y deja que cualquier cuenta consuma la cuota de Walinker
- Mensajes de soporte en el ticket de otro workspace
- registrar_vista y responder_cotizacion sin límite: métricas y estado manipulables con el token
- El PDF puede salir corrupto o con colores inválidos si el color de marca no es un hexadecimal de 6 dígitos
- El RPC público expone campos internos de la cotización (workspace_id, pagos, contador de visitas, wa_link)
- WhatsApp se abre con window.open después de varias esperas y el navegador puede bloquearlo como popup
