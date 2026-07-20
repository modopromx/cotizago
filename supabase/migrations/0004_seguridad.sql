-- CotizaGo — Endurecimiento de seguridad
--
-- Se aplica sobre la base EXISTENTE (proyecto mhvbsyacicntniapishp), que ya
-- tenía todas las tablas. Solo ALTER / CREATE / DROP POLICY: ninguna tabla ni
-- columna se elimina, ningún dato se toca salvo marcar is_admin.
--
-- Arregla tres cosas:
--   1. Las políticas "Public view ..." tenían USING (true): cualquiera con la
--      anon key leía TODAS las cotizaciones de TODOS los usuarios.
--   2. Siete tablas sin RLS, abiertas a lectura y escritura anónima.
--   3. folios_balance editable desde el navegador.

-- ===============================================================
-- 1. Rol de admin en la base de datos
--    Sustituye a VITE_ADMIN_EMAILS, que viajaba dentro del bundle público.
-- ===============================================================
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Se siembra desde admin_team, que ya contiene el equipo real.
-- Va ANTES de encender RLS: al revés, nadie quedaría como admin y el panel
-- de administración se volvería inaccesible para todos.
update public.profiles p
   set is_admin = true
 where exists (select 1 from public.admin_team a
                where lower(a.email) = lower(p.email));

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to authenticated;

-- ===============================================================
-- 2. profiles: el usuario edita su ficha, pero no su saldo ni su rol
--
-- Se resuelve con permisos por columna y no con WITH CHECK: una política de
-- profiles que consultara profiles se llamaría a sí misma y Postgres aborta
-- por recursión infinita. Los GRANT por columna se evalúan aparte de RLS, y
-- las funciones SECURITY DEFINER (que corren como dueño) los saltan, que es
-- justo lo que queremos para enviar_cotizacion y acreditar_folios.
-- ===============================================================
revoke update on public.profiles from authenticated;
grant update (
  nombre, empresa, razon_social, rfc, telefono, direccion, email_empresa,
  codigo_postal, pais, moneda, banco, titular, numero_cuenta, clabe,
  link_pago, logo_url, color_marca, updated_at
) on public.profiles to authenticated;

drop policy if exists "Users own profile" on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

-- ===============================================================
-- 3. Cotizaciones: cerrar la fuga
--
-- El token vivía en el WHERE que enviaba el navegador; quien lo quitaba se
-- llevaba la tabla entera. Ahora el acceso público pasa por una función que
-- exige el token como argumento.
-- ===============================================================
drop policy if exists "Public view cotizacion by token" on public.cotizaciones;
drop policy if exists "Public view items" on public.cotizacion_items;
drop policy if exists "Anyone insert view" on public.quote_views;

create policy cotizaciones_admin_read on public.cotizaciones
  for select using (public.is_admin());
create policy cotizacion_items_admin_read on public.cotizacion_items
  for select using (public.is_admin());

create or replace function public.get_cotizacion_publica(cotizacion_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  resultado jsonb;
begin
  select jsonb_build_object(
    'cotizacion', to_jsonb(c) - 'user_id' - 'cliente_id' - 'visto_ip',
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.orden)
        from public.cotizacion_items i
       where i.cotizacion_id = c.id), '[]'::jsonb),
    'emisor', jsonb_build_object(
      'nombre',        p.nombre,
      'empresa',       p.empresa,
      'telefono',      p.telefono,
      'email_empresa', p.email_empresa,
      'banco',         p.banco,
      'titular',       p.titular,
      'clabe',         p.clabe,
      'link_pago',     p.link_pago,
      'logo_url',      p.logo_url,
      'color_marca',   p.color_marca
    )
  )
  into resultado
  from public.cotizaciones c
  join public.profiles p on p.id = c.user_id
  where c.token = cotizacion_token
    and c.estado <> 'borrador';

  return resultado;
end $$;
grant execute on function public.get_cotizacion_publica(text) to anon, authenticated;

create or replace function public.registrar_vista(cotizacion_token text, ua text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare cot_id uuid;
begin
  select id into cot_id from public.cotizaciones where token = cotizacion_token;
  if cot_id is null then return; end if;

  insert into public.quote_views (cotizacion_id, user_agent) values (cot_id, ua);

  update public.cotizaciones
     set visto_count = coalesce(visto_count, 0) + 1,
         visto_at    = coalesce(visto_at, now()),
         estado      = case when estado = 'enviada' then 'vista' else estado end
   where id = cot_id;
end $$;
grant execute on function public.registrar_vista(text, text) to anon, authenticated;

create or replace function public.responder_cotizacion(cotizacion_token text, respuesta_cliente text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if respuesta_cliente not in ('aceptada','rechazada') then
    raise exception 'Respuesta inválida';
  end if;
  update public.cotizaciones
     set estado = respuesta_cliente, respuesta = respuesta_cliente
   where token = cotizacion_token and estado in ('enviada','vista');
end $$;
grant execute on function public.responder_cotizacion(text, text) to anon, authenticated;

-- ===============================================================
-- 4. Folios: descuento atómico del lado del servidor
-- ===============================================================
alter table public.cotizaciones
  add column if not exists enviada_at timestamptz;

create or replace function public.enviar_cotizacion(cotizacion_uuid uuid)
returns public.cotizaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  cot   public.cotizaciones;
  saldo integer;
begin
  select * into cot from public.cotizaciones
   where id = cotizacion_uuid and user_id = auth.uid()
   for update;

  if cot is null then
    raise exception 'Cotización no encontrada';
  end if;

  if cot.folio_consumido then
    return cot;  -- idempotente: no cobrar dos veces
  end if;

  update public.profiles
     set folios_balance = folios_balance - 1
   where id = auth.uid() and folios_balance >= 1
  returning folios_balance into saldo;

  if saldo is null then
    raise exception 'Sin folios disponibles';
  end if;

  update public.cotizaciones
     set estado = 'enviada', folio_consumido = true, enviada_at = now()
   where id = cotizacion_uuid
  returning * into cot;

  return cot;
end $$;
revoke all on function public.enviar_cotizacion(uuid) from public, anon;
grant execute on function public.enviar_cotizacion(uuid) to authenticated;

create or replace function public.acreditar_folios(pago_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare p public.pagos;
begin
  select * into p from public.pagos where id = pago_uuid for update;
  if p is null or p.estado = 'aprobado' then return; end if;

  update public.pagos set estado = 'aprobado' where id = pago_uuid;
  update public.profiles set folios_balance = folios_balance + p.folios where id = p.user_id;
end $$;
-- Solo el webhook de Stripe (service_role) la invoca; el navegador nunca.
revoke all on function public.acreditar_folios(uuid) from public, anon, authenticated;

-- ===============================================================
-- 5. RLS en las siete tablas que estaban abiertas
--
-- Cada ALTER va junto con sus políticas en la misma transacción: encender RLS
-- sin políticas bloquea la tabla por completo y rompe el panel de admin.
-- ===============================================================

-- paquetes_folios: catálogo que la landing muestra sin login
alter table public.paquetes_folios enable row level security;
create policy paquetes_read on public.paquetes_folios
  for select to anon, authenticated using (coalesce(activo, true) or public.is_admin());
create policy paquetes_admin on public.paquetes_folios
  for all using (public.is_admin()) with check (public.is_admin());

-- admin_team / email_templates / logs_sistema: solo administradores
alter table public.admin_team enable row level security;
create policy admin_team_admin on public.admin_team
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.email_templates enable row level security;
create policy email_templates_admin on public.email_templates
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.logs_sistema enable row level security;
create policy logs_admin on public.logs_sistema
  for select using (public.is_admin());

-- soporte_tickets: el usuario abre y lee los suyos; el admin responde
alter table public.soporte_tickets enable row level security;
create policy soporte_read on public.soporte_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy soporte_insert on public.soporte_tickets
  for insert with check (user_id = auth.uid());
create policy soporte_admin_update on public.soporte_tickets
  for update using (public.is_admin()) with check (public.is_admin());

-- facturas_solicitudes: contiene RFC y razón social, datos fiscales
alter table public.facturas_solicitudes enable row level security;
create policy facturas_read on public.facturas_solicitudes
  for select using (user_id = auth.uid() or public.is_admin());
create policy facturas_insert on public.facturas_solicitudes
  for insert with check (user_id = auth.uid());
create policy facturas_admin on public.facturas_solicitudes
  for update using (public.is_admin()) with check (public.is_admin());

-- config_plataforma: admin, salvo las claves marcadas como públicas,
-- que salen por una vista para que el resto nunca viaje al navegador
alter table public.config_plataforma
  add column if not exists publico boolean not null default false;

update public.config_plataforma
   set publico = true
 where clave in ('nombre_plataforma','meta_title','meta_description',
                 'copyright','whatsapp_ventas','whatsapp_mensaje');

alter table public.config_plataforma enable row level security;
create policy config_admin on public.config_plataforma
  for all using (public.is_admin()) with check (public.is_admin());

create or replace view public.config_publica as
  select clave, valor from public.config_plataforma where publico;
grant select on public.config_publica to anon, authenticated;

-- notificaciones ya tenía RLS por usuario; se agrega lectura de admin
drop policy if exists notificaciones_admin on public.notificaciones;
create policy notificaciones_admin on public.notificaciones
  for select using (public.is_admin());
