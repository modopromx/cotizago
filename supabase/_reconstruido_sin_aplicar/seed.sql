-- CotizaGo — Datos iniciales
-- Ejecutar UNA vez, después de las tres migraciones.

-- Paquetes de folios (los mismos precios que muestra la landing)
insert into public.paquetes_folios (nombre, folios, precio, moneda, popular, orden) values
  ('Pack 100', 100, 149,  'MXN', false, 1),
  ('Pack 300', 300, 299,  'MXN', true,  2),
  ('Pack 800', 800, 599,  'MXN', false, 3)
on conflict do nothing;

-- Configuración pública (visible sin login vía la vista config_publica)
insert into public.config_plataforma (clave, valor, publico) values
  ('whatsapp_ventas',  '', true),
  ('whatsapp_mensaje', '¡Hola! Quiero saber más sobre CotizaGo', true),
  ('email_soporte',    '', true)
on conflict (clave) do nothing;

-- Plantillas de email
insert into public.email_templates (nombre, asunto, cuerpo_html, variables_disponibles) values
  ('bienvenida',
   'Bienvenido a CotizaGo 👋',
   '<p>Hola {{nombre}}, tu cuenta está lista. Tienes {{folios}} folios de cortesía para empezar.</p>',
   array['nombre','folios']),
  ('cotizacion_enviada',
   'Cotización {{numero}} de {{empresa}}',
   '<p>Hola {{cliente_nombre}}, aquí está tu cotización por {{total}}.</p><p><a href="{{link}}">Ver cotización</a></p>',
   array['cliente_nombre','empresa','numero','total','link']),
  ('cotizacion_aceptada',
   '¡{{cliente_nombre}} aceptó la cotización {{numero}}!',
   '<p>Buenas noticias: tu cotización {{numero}} por {{total}} fue aceptada.</p>',
   array['cliente_nombre','numero','total']),
  ('pago_exitoso',
   'Compra confirmada — {{folios}} folios acreditados',
   '<p>Recibimos tu pago de {{monto}}. Ya tienes {{folios}} folios nuevos en tu cuenta.</p>',
   array['folios','monto'])
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------
-- Marcar tu cuenta como admin.
-- Regístrate primero en la app, y luego ejecuta esto con tu email:
--
--   update public.profiles set is_admin = true where email = 'tu@email.com';
--
-- Esto sustituye a VITE_ADMIN_EMAILS, que iba dentro del bundle público.
-- ---------------------------------------------------------------
