-- CotizaGo — Sprint 0: Fundación multi-tenant
--
-- Introduce la capa workspace/miembro que la spec pide (separar cuenta de
-- usuario), SIN romper el frontend actual:
--   * Se conserva user_id en todas las tablas.
--   * workspace_id es nuevo y se rellena solo por trigger, así los INSERT del
--     frontend actual (que no lo mandan) siguen funcionando.
--   * RLS pasa a basarse en membresía de workspace.
--
-- Se ejecuta con 1 usuario, 1 cliente y 0 cotizaciones: el backfill es trivial
-- y no hay datos de clientes en riesgo. Este es el momento barato de hacerlo.

-- ===============================================================
-- 1. Workspaces y miembros
-- ===============================================================
create table if not exists public.workspaces (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  plan           text not null default 'gratis',
  folios_balance integer not null default 0 check (folios_balance >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  rol          text not null default 'member' check (rol in ('owner','admin','member')),
  permisos     jsonb not null default '{}'::jsonb,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists ws_members_user_idx on public.workspace_members(user_id) where activo;

-- Workspace activo del usuario. Con esto el trigger de autorelleno sabe a qué
-- workspace pertenece un INSERT que no trae workspace_id explícito.
alter table public.profiles
  add column if not exists workspace_id uuid references public.workspaces(id);

-- ===============================================================
-- 2. Helpers (SECURITY DEFINER para no disparar RLS recursivo)
-- ===============================================================
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
     where m.workspace_id = ws and m.user_id = auth.uid() and m.activo
  );
$$;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create or replace function public.default_workspace_id()
returns uuid language sql security definer stable set search_path = public as $$
  select workspace_id from public.profiles where id = auth.uid();
$$;
grant execute on function public.default_workspace_id() to authenticated;

-- ===============================================================
-- 3. workspace_id en las tablas de datos por-tenant
-- ===============================================================
alter table public.clientes             add column if not exists workspace_id uuid references public.workspaces(id);
alter table public.productos            add column if not exists workspace_id uuid references public.workspaces(id);
alter table public.cotizaciones         add column if not exists workspace_id uuid references public.workspaces(id);
alter table public.pagos                add column if not exists workspace_id uuid references public.workspaces(id);
alter table public.soporte_tickets      add column if not exists workspace_id uuid references public.workspaces(id);
alter table public.facturas_solicitudes add column if not exists workspace_id uuid references public.workspaces(id);
alter table public.notificaciones       add column if not exists workspace_id uuid references public.workspaces(id);

-- ===============================================================
-- 4. Empresa emisora (datos fiscales que hoy viven sueltos en profiles)
--    Pertenecen al workspace, no a la persona.
-- ===============================================================
create table if not exists public.empresas (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  tipo                 text not null default 'empresa' check (tipo in ('empresa','persona_fisica')),
  nombre_comercial     text,
  razon_social         text,
  nombre_fiscal        text,
  rfc                  text,
  regimen_fiscal       text,
  codigo_postal        text,
  pais                 text default 'MX',
  direccion            text,
  telefono             text,
  email                text,
  sitio_web            text,
  logo_url             text,
  color_principal      text default '#08AEB6',
  moneda               text default 'MXN',
  impuesto_default     numeric(5,2) default 16,
  vigencia_dias        integer default 15,
  condiciones          text,
  -- datos bancarios que hoy están en profiles
  banco                text,
  titular              text,
  numero_cuenta        text,
  clabe                text,
  link_pago            text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workspace_id)
);

-- ===============================================================
-- 5. Libro de folios (auditable). El saldo sigue en profiles/workspaces por
--    ahora; esta tabla registra CADA movimiento para poder responder
--    "¿por qué tengo este saldo?".
-- ===============================================================
create table if not exists public.folio_transactions (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  tipo              text not null check (tipo in ('saldo_inicial','compra','consumo','ajuste_admin','reembolso')),
  folios            integer not null,          -- positivo acredita, negativo consume
  saldo_resultante  integer,
  referencia        text,
  pago_id           uuid references public.pagos(id) on delete set null,
  cotizacion_id     uuid references public.cotizaciones(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists folio_tx_ws_idx on public.folio_transactions(workspace_id, created_at desc);

-- ===============================================================
-- 6. BACKFILL: crear un workspace por cada usuario existente y colgar sus datos
-- ===============================================================
do $$
declare
  prof record;
  ws_id uuid;
begin
  for prof in select * from public.profiles loop
    -- workspace personal
    insert into public.workspaces (nombre, owner_id, plan, folios_balance)
    values (coalesce(prof.empresa, prof.nombre, 'Mi empresa'), prof.id,
            coalesce(prof.plan, 'gratis'), coalesce(prof.folios_balance, 0))
    returning id into ws_id;

    -- membresía como owner
    insert into public.workspace_members (workspace_id, user_id, rol)
    values (ws_id, prof.id, 'owner')
    on conflict (workspace_id, user_id) do nothing;

    -- workspace activo del usuario
    update public.profiles set workspace_id = ws_id where id = prof.id;

    -- empresa emisora a partir de los datos fiscales del perfil
    insert into public.empresas (
      workspace_id, nombre_comercial, razon_social, rfc, codigo_postal, pais,
      direccion, telefono, email, logo_url, color_principal, moneda,
      banco, titular, numero_cuenta, clabe, link_pago)
    values (
      ws_id, prof.empresa, prof.razon_social, prof.rfc, prof.codigo_postal,
      coalesce(prof.pais,'MX'), prof.direccion, prof.telefono,
      coalesce(prof.email_empresa, prof.email), prof.logo_url,
      coalesce(prof.color_marca,'#08AEB6'), coalesce(prof.moneda,'MXN'),
      prof.banco, prof.titular, prof.numero_cuenta, prof.clabe, prof.link_pago)
    on conflict (workspace_id) do nothing;

    -- saldo inicial en el libro
    if coalesce(prof.folios_balance,0) > 0 then
      insert into public.folio_transactions (workspace_id, tipo, folios, saldo_resultante, referencia, created_by)
      values (ws_id, 'saldo_inicial', prof.folios_balance, prof.folios_balance,
              'Saldo migrado al crear el workspace', prof.id);
    end if;
  end loop;
end $$;

-- colgar las filas existentes en el workspace de su dueño
update public.clientes        c set workspace_id = p.workspace_id from public.profiles p where p.id = c.user_id and c.workspace_id is null;
update public.productos        r set workspace_id = p.workspace_id from public.profiles p where p.id = r.user_id and r.workspace_id is null;
update public.cotizaciones     q set workspace_id = p.workspace_id from public.profiles p where p.id = q.user_id and q.workspace_id is null;
update public.pagos            g set workspace_id = p.workspace_id from public.profiles p where p.id = g.user_id and g.workspace_id is null;
update public.soporte_tickets  s set workspace_id = p.workspace_id from public.profiles p where p.id = s.user_id and s.workspace_id is null;
update public.facturas_solicitudes f set workspace_id = p.workspace_id from public.profiles p where p.id = f.user_id and f.workspace_id is null;
update public.notificaciones   n set workspace_id = p.workspace_id from public.profiles p where p.id = n.user_id and n.workspace_id is null;

-- ===============================================================
-- 7. Autorelleno de workspace_id en INSERT (mantiene vivo el frontend actual)
-- ===============================================================
create or replace function public.set_workspace_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is null then
    new.workspace_id := public.default_workspace_id();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','productos','cotizaciones','pagos',
    'soporte_tickets','facturas_solicitudes','notificaciones'
  ] loop
    execute format(
      'drop trigger if exists set_ws_%1$s on public.%1$s;
       create trigger set_ws_%1$s before insert on public.%1$s
       for each row execute function public.set_workspace_id();', t);
  end loop;
end $$;

-- ===============================================================
-- 8. RLS de las tablas nuevas + repunte de las existentes a workspace
-- ===============================================================
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.empresas           enable row level security;
alter table public.folio_transactions enable row level security;

create policy ws_read on public.workspaces
  for select using (is_workspace_member(id) or public.is_admin());
create policy ws_update on public.workspaces
  for update using (owner_id = auth.uid() or public.is_admin());

create policy wsm_read on public.workspace_members
  for select using (is_workspace_member(workspace_id) or public.is_admin());
create policy wsm_manage on public.workspace_members
  for all using (
    exists (select 1 from public.workspaces w
             where w.id = workspace_id and w.owner_id = auth.uid())
    or public.is_admin()
  ) with check (
    exists (select 1 from public.workspaces w
             where w.id = workspace_id and w.owner_id = auth.uid())
    or public.is_admin()
  );

create policy empresas_member on public.empresas
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

create policy folio_tx_read on public.folio_transactions
  for select using (is_workspace_member(workspace_id) or public.is_admin());

-- Repuntar las políticas de datos por-tenant de user_id a membresía de workspace.
drop policy if exists "Users own clientes" on public.clientes;
drop policy if exists clientes_own on public.clientes;
drop policy if exists clientes_admin on public.clientes;
create policy clientes_ws on public.clientes
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

drop policy if exists "Users own productos" on public.productos;
drop policy if exists productos_own on public.productos;
drop policy if exists productos_admin on public.productos;
create policy productos_ws on public.productos
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

drop policy if exists "Users own cotizaciones" on public.cotizaciones;
drop policy if exists cotizaciones_admin_read on public.cotizaciones;
create policy cotizaciones_ws on public.cotizaciones
  for all using (is_workspace_member(workspace_id) or public.is_admin())
  with check (is_workspace_member(workspace_id));

drop policy if exists "Users own pagos" on public.pagos;
drop policy if exists pagos_own_read on public.pagos;
create policy pagos_ws_read on public.pagos
  for select using (is_workspace_member(workspace_id) or public.is_admin());

drop policy if exists soporte_read on public.soporte_tickets;
drop policy if exists soporte_insert on public.soporte_tickets;
drop policy if exists soporte_admin_update on public.soporte_tickets;
create policy soporte_ws_read on public.soporte_tickets
  for select using (is_workspace_member(workspace_id) or public.is_admin());
create policy soporte_ws_insert on public.soporte_tickets
  for insert with check (is_workspace_member(workspace_id));
create policy soporte_admin_update on public.soporte_tickets
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists facturas_read on public.facturas_solicitudes;
drop policy if exists facturas_insert on public.facturas_solicitudes;
drop policy if exists facturas_admin on public.facturas_solicitudes;
create policy facturas_ws_read on public.facturas_solicitudes
  for select using (is_workspace_member(workspace_id) or public.is_admin());
create policy facturas_ws_insert on public.facturas_solicitudes
  for insert with check (is_workspace_member(workspace_id));
create policy facturas_admin on public.facturas_solicitudes
  for update using (public.is_admin()) with check (public.is_admin());

-- cotizacion_items: sigue el workspace de su cotización padre
drop policy if exists "Users own items" on public.cotizacion_items;
drop policy if exists cotizacion_items_admin_read on public.cotizacion_items;
create policy cotizacion_items_ws on public.cotizacion_items
  for all using (
    exists (select 1 from public.cotizaciones c
             where c.id = cotizacion_id
               and (is_workspace_member(c.workspace_id) or public.is_admin()))
  ) with check (
    exists (select 1 from public.cotizaciones c
             where c.id = cotizacion_id and is_workspace_member(c.workspace_id))
  );

drop policy if exists notificaciones_admin on public.notificaciones;
drop policy if exists "Users own notificaciones" on public.notificaciones;
create policy notificaciones_ws on public.notificaciones
  for all using (
    user_id = auth.uid() or is_workspace_member(workspace_id) or public.is_admin()
  ) with check (
    user_id = auth.uid() or is_workspace_member(workspace_id)
  );

-- ===============================================================
-- 9. Reescribir las funciones de folios: registran en el libro y corrigen
--    el bug de acreditar_folios (usaba columnas inexistentes).
-- ===============================================================
create or replace function public.enviar_cotizacion(cotizacion_uuid uuid)
returns public.cotizaciones language plpgsql security definer set search_path = public as $$
declare cot public.cotizaciones; saldo integer;
begin
  select * into cot from public.cotizaciones
   where id = cotizacion_uuid and is_workspace_member(workspace_id) for update;
  if cot is null then raise exception 'Cotización no encontrada'; end if;
  if cot.folio_consumido then return cot; end if;

  update public.profiles set folios_balance = folios_balance - 1
   where id = cot.user_id and folios_balance >= 1
  returning folios_balance into saldo;
  if saldo is null then raise exception 'Sin folios disponibles'; end if;

  update public.workspaces set folios_balance = greatest(folios_balance - 1, 0)
   where id = cot.workspace_id;

  update public.cotizaciones
     set estado = 'enviada', folio_consumido = true, enviada_at = now()
   where id = cotizacion_uuid returning * into cot;

  insert into public.folio_transactions
    (workspace_id, tipo, folios, saldo_resultante, referencia, cotizacion_id, created_by)
  values (cot.workspace_id, 'consumo', -1, saldo,
          'Cotización ' || cot.numero, cot.id, auth.uid());

  return cot;
end $$;
revoke all on function public.enviar_cotizacion(uuid) from public, anon;
grant execute on function public.enviar_cotizacion(uuid) to authenticated;

create or replace function public.acreditar_folios(pago_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare pg public.pagos; nuevo integer;
begin
  select * into pg from public.pagos where id = pago_uuid for update;
  if pg is null or coalesce(pg.acreditado, false) then return; end if;  -- idempotente

  update public.pagos
     set acreditado = true, acreditado_at = now(), estado = 'aprobado'
   where id = pago_uuid;

  update public.profiles
     set folios_balance = folios_balance + coalesce(pg.folios_cantidad, 0)
   where id = pg.user_id
  returning folios_balance into nuevo;

  update public.workspaces
     set folios_balance = folios_balance + coalesce(pg.folios_cantidad, 0)
   where id = pg.workspace_id;

  insert into public.folio_transactions
    (workspace_id, tipo, folios, saldo_resultante, referencia, pago_id, created_by)
  values (pg.workspace_id, 'compra', coalesce(pg.folios_cantidad,0), nuevo,
          coalesce(pg.paquete_nombre, 'Compra de folios'), pg.id, pg.user_id);
end $$;
revoke all on function public.acreditar_folios(uuid) from public, anon, authenticated;

-- Ajuste de folios por el superadministrador, auditable.
create or replace function public.ajustar_folios(ws uuid, delta integer, motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid; nuevo integer;
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;

  select owner_id into owner from public.workspaces where id = ws;
  if owner is null then raise exception 'Workspace no encontrado'; end if;

  update public.profiles set folios_balance = greatest(folios_balance + delta, 0)
   where id = owner returning folios_balance into nuevo;
  update public.workspaces set folios_balance = greatest(folios_balance + delta, 0)
   where id = ws;

  insert into public.folio_transactions
    (workspace_id, tipo, folios, saldo_resultante, referencia, created_by)
  values (ws, 'ajuste_admin', delta, nuevo, coalesce(motivo,'Ajuste manual'), auth.uid());
end $$;
revoke all on function public.ajustar_folios(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.ajustar_folios(uuid, integer, text) to authenticated;

-- ===============================================================
-- 10. Alta de usuario: crear workspace + membresía + empresa automáticamente
-- ===============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare ws_id uuid;
begin
  insert into public.profiles (id, email, nombre, empresa, folios_balance)
  values (new.id, new.email,
          new.raw_user_meta_data->>'nombre',
          new.raw_user_meta_data->>'empresa', 5)
  on conflict (id) do nothing;

  insert into public.workspaces (nombre, owner_id, folios_balance)
  values (coalesce(new.raw_user_meta_data->>'empresa', new.raw_user_meta_data->>'nombre', 'Mi empresa'),
          new.id, 5)
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, rol)
  values (ws_id, new.id, 'owner');

  update public.profiles set workspace_id = ws_id where id = new.id;

  insert into public.empresas (workspace_id, nombre_comercial, email)
  values (ws_id, new.raw_user_meta_data->>'empresa', new.email);

  insert into public.folio_transactions (workspace_id, tipo, folios, saldo_resultante, referencia, created_by)
  values (ws_id, 'saldo_inicial', 5, 5, 'Folios de cortesía al registrarse', new.id);

  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ===============================================================
-- 11. Corregir precios de paquetes al diseño aprobado
-- ===============================================================
update public.paquetes_folios set activo = false;

insert into public.paquetes_folios (nombre, folios, precio, moneda, popular, activo, orden) values
  ('Emprende', 25,  199, 'MXN', false, true, 1),
  ('Negocio',  100, 499, 'MXN', true,  true, 2),
  ('Pro',      300, 999, 'MXN', false, true, 3);
