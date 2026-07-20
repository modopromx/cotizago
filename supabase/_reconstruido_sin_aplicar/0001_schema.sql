-- CotizaGo — Esquema base
-- Reconstruido a partir del código de src/ tras la pérdida del proyecto Supabase.
-- Orden importa: las tablas referenciadas van primero.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- profiles — un registro por usuario de auth.users
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,

  -- datos de empresa (ConfiguracionPage)
  nombre          text,
  empresa         text,
  razon_social    text,
  rfc             text,
  telefono        text,
  direccion       text,
  email_empresa   text,
  codigo_postal   text,
  pais            text not null default 'MX',
  moneda          text not null default 'MXN',

  -- datos de pago que aparecen en la cotización pública
  banco           text,
  titular         text,
  numero_cuenta   text,
  clabe           text,
  link_pago       text,

  -- marca
  logo_url        text,
  color_marca     text not null default '#1e7363',

  -- plan y saldo
  folios_balance  integer not null default 0 check (folios_balance >= 0),
  plan            text not null default 'free',

  -- rol: sustituye a VITE_ADMIN_EMAILS, que era manipulable desde el navegador
  is_admin        boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  nombre        text not null,
  empresa       text,
  rfc           text,
  razon_social  text,
  email         text,
  telefono      text,
  whatsapp      text,
  pais          text default 'MX',
  codigo_postal text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists clientes_user_id_idx on public.clientes(user_id) where activo;

-- ---------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------
create table if not exists public.productos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  precio      numeric(14,2) not null default 0,
  unidad      text not null default 'servicio',
  iva         numeric(5,2) not null default 16,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists productos_user_id_idx on public.productos(user_id) where activo;

-- ---------------------------------------------------------------
-- cotizaciones
-- ---------------------------------------------------------------
create table if not exists public.cotizaciones (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  cliente_id           uuid references public.clientes(id) on delete set null,
  numero               text not null,

  -- token del link público /c/:token — se genera solo, nunca desde el cliente
  token                text not null unique default encode(gen_random_bytes(16), 'hex'),

  fecha_emision        date not null default current_date,
  fecha_vencimiento    date,
  moneda               text not null default 'MXN',

  notas                text,
  terminos             text,

  subtotal             numeric(14,2) not null default 0,
  descuento_porcentaje numeric(5,2)  not null default 0,
  descuento_monto      numeric(14,2) not null default 0,
  impuestos            numeric(14,2) not null default 0,
  total                numeric(14,2) not null default 0,

  estado               text not null default 'borrador'
                       check (estado in ('borrador','enviada','vista','aceptada','rechazada','vencida')),
  respuesta            text,
  folio_consumido      boolean not null default false,

  -- snapshot del cliente al momento de emitir: si el cliente cambia después,
  -- la cotización ya enviada conserva los datos con los que se envió
  cliente_nombre       text,
  cliente_empresa      text,
  cliente_email        text,
  cliente_whatsapp     text,
  cliente_pais         text,
  cliente_cp           text,
  cliente_rfc          text,
  cliente_razon_social text,

  enviada_at           timestamptz,
  visto_at             timestamptz,
  visto_count          integer not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (user_id, numero)
);
create index if not exists cotizaciones_user_id_idx on public.cotizaciones(user_id, created_at desc);
create index if not exists cotizaciones_token_idx   on public.cotizaciones(token);

-- ---------------------------------------------------------------
-- cotizacion_items
-- ---------------------------------------------------------------
create table if not exists public.cotizacion_items (
  id              uuid primary key default gen_random_uuid(),
  cotizacion_id   uuid not null references public.cotizaciones(id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  cantidad        numeric(14,3) not null default 1,
  precio_unitario numeric(14,2) not null default 0,
  iva_porcentaje  numeric(5,2)  not null default 16,
  subtotal        numeric(14,2) not null default 0,
  orden           integer not null default 0
);
create index if not exists cotizacion_items_cot_idx on public.cotizacion_items(cotizacion_id, orden);

-- ---------------------------------------------------------------
-- quote_views — tracking de aperturas del link público
-- ---------------------------------------------------------------
create table if not exists public.quote_views (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  ip            text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists quote_views_cot_idx on public.quote_views(cotizacion_id, created_at desc);

-- ---------------------------------------------------------------
-- paquetes_folios — catálogo de packs a la venta
-- ---------------------------------------------------------------
create table if not exists public.paquetes_folios (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  folios           integer not null,
  precio           numeric(14,2) not null,
  moneda           text not null default 'MXN',
  stripe_price_id  text,
  popular          boolean not null default false,
  activo           boolean not null default true,
  orden            integer not null default 1,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- pagos
-- ---------------------------------------------------------------
create table if not exists public.pagos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles(id) on delete set null,
  paquete_id         uuid references public.paquetes_folios(id) on delete set null,
  monto              numeric(14,2) not null default 0,
  moneda             text not null default 'MXN',
  folios             integer not null default 0,
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente','aprobado','fallido','reembolsado')),
  stripe_session_id  text unique,
  stripe_payment_id  text,
  created_at         timestamptz not null default now()
);
create index if not exists pagos_user_idx on public.pagos(user_id, created_at desc);

-- ---------------------------------------------------------------
-- soporte_tickets
-- ---------------------------------------------------------------
create table if not exists public.soporte_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  titulo      text not null,
  descripcion text,
  prioridad   text not null default 'normal' check (prioridad in ('baja','normal','alta','urgente')),
  estado      text not null default 'abierto' check (estado in ('abierto','en_progreso','resuelto','cerrado')),
  respuesta   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists soporte_user_idx on public.soporte_tickets(user_id, created_at desc);

-- ---------------------------------------------------------------
-- admin_team
-- ---------------------------------------------------------------
create table if not exists public.admin_team (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  email        text not null unique,
  rol          text not null default 'admin',
  departamento text default 'Administración',
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- email_templates
-- ---------------------------------------------------------------
create table if not exists public.email_templates (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique,
  asunto                text not null,
  cuerpo_html           text not null,
  variables_disponibles text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- logs_sistema
-- ---------------------------------------------------------------
create table if not exists public.logs_sistema (
  id         uuid primary key default gen_random_uuid(),
  nivel      text not null default 'info' check (nivel in ('info','warn','error')),
  mensaje    text not null,
  contexto   jsonb,
  user_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists logs_created_idx on public.logs_sistema(created_at desc);

-- ---------------------------------------------------------------
-- config_plataforma
--
-- OJO: aquí NO van secretos (stripe_secret_key, webhook secret, API keys).
-- Esos viven en los secrets de las Edge Functions. Ver 0002_rls.sql: esta
-- tabla es legible solo por admin, y las claves públicas se exponen aparte
-- mediante la vista config_publica.
-- ---------------------------------------------------------------
create table if not exists public.config_plataforma (
  clave      text primary key,
  valor      text,
  publico    boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clientes','productos','cotizaciones',
    'soporte_tickets','email_templates'
  ] loop
    execute format(
      'drop trigger if exists touch_%1$s on public.%1$s;
       create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;
