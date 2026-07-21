-- CotizaGo — Plantillas de mensajes (WhatsApp / Email) por workspace.
-- Reemplaza el mockup estático de PlantillasPage por plantillas reales editables,
-- según el diseño de referencia (envío inicial, recordatorio, aceptada, etc.).

create table if not exists public.plantillas_mensajes (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  canal        text not null check (canal in ('whatsapp','email')),
  momento      text not null check (momento in ('envio_inicial','recordatorio','aceptada','rechazada','vencida')),
  nombre       text not null,
  asunto       text,            -- solo aplica a email
  cuerpo       text not null,
  activa       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, canal, momento)
);
create index if not exists plantillas_ws_idx on public.plantillas_mensajes(workspace_id);

alter table public.plantillas_mensajes enable row level security;
create policy plantillas_ws on public.plantillas_mensajes
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

drop trigger if exists touch_plantillas on public.plantillas_mensajes;
create trigger touch_plantillas before update on public.plantillas_mensajes
  for each row execute function public.update_updated_at();

-- Sembrar plantillas por defecto para los workspaces que aún no tengan.
insert into public.plantillas_mensajes (workspace_id, canal, momento, nombre, asunto, cuerpo)
select w.id, d.canal, d.momento, d.nombre, d.asunto, d.cuerpo
from public.workspaces w
cross join (values
  ('whatsapp','envio_inicial','WhatsApp · Envío inicial', null,
   'Hola {{cliente}} 👋\n\nTe comparto la cotización {{folio}} por un total de {{total}}.\n\nPuedes revisarla y confirmar desde aquí:\n{{enlace_publico}}\n\nQuedo atento a tus comentarios.'),
  ('email','envio_inicial','Email · Envío inicial','Cotización {{folio}} de {{empresa}}',
   'Hola {{cliente}},\n\nAdjunto encontrarás la cotización {{folio}} por {{total}}.\n\nRevísala aquí: {{enlace_publico}}\n\nSaludos,\n{{empresa}}'),
  ('whatsapp','recordatorio','Recordatorio pendiente', null,
   'Hola {{cliente}}, ¿tuviste oportunidad de revisar la cotización {{folio}}? Sigue disponible aquí: {{enlace_publico}}'),
  ('whatsapp','aceptada','Confirmación de aceptación', null,
   '¡Gracias {{cliente}}! Confirmamos la aceptación de la cotización {{folio}}. Pronto nos pondremos en contacto para los siguientes pasos.')
) as d(canal, momento, nombre, asunto, cuerpo)
on conflict (workspace_id, canal, momento) do nothing;
