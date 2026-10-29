-- Aplicada en Supabase como plantillas_las_cuatro_para_todos (29-oct-2026).
-- Las 4 plantillas para todas las cuentas (decisión de Omar):
--   WhatsApp · envío inicial  -> se usa al enviar por WhatsApp.
--   WhatsApp · recordatorio / aceptada -> se mandan a mano desde Cotizaciones.
--   Email · envío inicial -> solo si la cuenta conectó su propio correo
--                             (módulo email_profesional + integraciones.tipo='email').
create or replace function public.sembrar_plantillas(ws uuid)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.plantillas_mensajes (workspace_id, canal, momento, nombre, asunto, cuerpo) values
  (ws, 'whatsapp', 'envio_inicial', 'WhatsApp · Envío inicial', null,
   E'Hola {{cliente}} 👋\n\nTe comparto la cotización {{folio}} por un total de {{total}}.\n\nPuedes revisarla y confirmar desde aquí:\n{{enlace_publico}}\n\nQuedo atento a tus comentarios.'),
  (ws, 'whatsapp', 'recordatorio', 'Recordatorio pendiente', null,
   E'Hola {{cliente}}\n\n¿Tuviste oportunidad de revisar la cotización {{folio}}?\n\nSigue disponible aquí: {{enlace_publico}}'),
  (ws, 'whatsapp', 'aceptada', 'Confirmación de aceptación', null,
   E'¡Gracias {{cliente}}!\nConfirmamos la aceptación de la cotización {{folio}}.\n\nPronto nos pondremos en contacto para los siguientes pasos.'),
  (ws, 'email', 'envio_inicial', 'Email · Envío inicial', 'Cotización {{folio}} de {{empresa}}',
   E'Hola {{cliente}},\n\nTe comparto la cotización {{folio}} por {{total}}.\n\nRevísala aquí: {{enlace_publico}}\n\nSaludos,\n{{vendedor}}\n{{empresa}}')
  on conflict (workspace_id, canal, momento) do nothing;
$$;
revoke all on function public.sembrar_plantillas(uuid) from public, anon, authenticated;

select public.sembrar_plantillas(id) from public.workspaces;
