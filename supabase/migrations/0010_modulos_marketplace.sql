-- CotizaGo — Marketplace de módulos contratables + config de email.
--
-- Reglas de negocio:
--  * Módulos de pago mensual. WhatsApp propio y Email profesional a $99/mes.
--  * El módulo "Email profesional" desbloquea la config SMTP PROPIA del usuario
--    una vez activo (tras pagar). Se guarda en email_conexiones (por workspace).
--  * El email COMPARTIDO de la plataforma (SMTP/Resend) se configura en el panel
--    admin — sus claves viven en config_plataforma (solo admin) y, las sensibles,
--    en secrets de la Edge Function de envío.
--  * Límite anti-spam: máximo de emails por día por workspace.

-- Catálogo de módulos
create table if not exists public.modulos (
  id           uuid primary key default gen_random_uuid(),
  clave        text not null unique,
  nombre       text not null,
  descripcion  text,
  precio       numeric(10,2) not null default 0,
  periodicidad text not null default 'mensual',
  activo       boolean not null default true,
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.modulos enable row level security;
create policy modulos_read on public.modulos
  for select to anon, authenticated using (activo or public.is_admin());
create policy modulos_admin on public.modulos
  for all using (public.is_admin()) with check (public.is_admin());

-- Suscripciones a módulos (por workspace)
create table if not exists public.modulo_suscripciones (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  clave              text not null,
  estado             text not null default 'activa' check (estado in ('activa','pendiente_pago','cancelada')),
  config             jsonb not null default '{}'::jsonb,
  fecha_contratacion timestamptz not null default now(),
  fecha_renovacion   timestamptz,
  created_at         timestamptz not null default now(),
  unique (workspace_id, clave)
);
create index if not exists mod_susc_ws_idx on public.modulo_suscripciones(workspace_id);

alter table public.modulo_suscripciones enable row level security;
create policy mod_susc_ws on public.modulo_suscripciones
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

-- Config SMTP PROPIA del usuario (se llena tras activar "Email profesional")
create table if not exists public.email_conexiones (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade unique,
  host         text,
  puerto       integer default 587,
  usuario      text,
  password     text,        -- sensible: protegido por RLS; mover a vault/secret al enviar
  from_email   text,
  from_nombre  text,
  activa       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.email_conexiones enable row level security;
create policy email_conn_ws on public.email_conexiones
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

-- Límite anti-spam: emails por día por workspace
alter table public.workspaces
  add column if not exists limite_emails_dia integer not null default 50;

-- Registro de envíos para hacer valer el límite (lo escribe la Edge Function de email)
create table if not exists public.email_envios (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  destinatario text,
  asunto       text,
  estado       text default 'enviado',
  created_at   timestamptz not null default now()
);
create index if not exists email_envios_ws_dia_idx on public.email_envios(workspace_id, created_at);

alter table public.email_envios enable row level security;
create policy email_envios_ws on public.email_envios
  for select using (is_workspace_member(workspace_id) or public.is_admin());

-- Seed del catálogo (WhatsApp propio y Email a $99; resto según diseño)
insert into public.modulos (clave, nombre, descripcion, precio, orden) values
  ('whatsapp_propio',   'WhatsApp propio',    'Conecta tu número y envía cotizaciones desde tu cuenta.',        99,  1),
  ('email_profesional', 'Email profesional',  'Envía desde tu dominio y recibe estadísticas de apertura.',      99,  2),
  ('pagos_linea',       'Pagos en línea',     'Agrega un botón de pago a las cotizaciones aceptadas.',          199, 3),
  ('crm',               'CRM y seguimiento',  'Automatiza recordatorios y etapas de cada oportunidad.',         179, 4),
  ('api_webhooks',      'API y webhooks',     'Integra Cotiza Go con tus sistemas y automatizaciones.',         249, 5),
  ('equipo_ventas',     'Equipo de ventas',   'Invita vendedores, asigna permisos y mide resultados.',          129, 6)
on conflict (clave) do update set precio = excluded.precio, nombre = excluded.nombre, descripcion = excluded.descripcion;

-- Config del email COMPARTIDO de la plataforma (panel admin). Sin la contraseña,
-- que va en secrets de la Edge Function (RESEND_API_KEY / SMTP_PASSWORD).
insert into public.config_plataforma (clave, valor, publico) values
  ('smtp_host', '', false),
  ('smtp_port', '587', false),
  ('smtp_from', '', false),
  ('smtp_from_nombre', 'Cotiza Go', false),
  ('email_limite_dia_default', '50', false)
on conflict (clave) do nothing;
