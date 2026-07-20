-- CotizaGo — Row Level Security
--
-- Regla de fondo: la anon key de Supabase es PÚBLICA (va dentro del bundle que
-- cualquiera descarga). Lo único que separa los datos de un usuario de los de
-- otro son estas políticas. Sin ellas, esconder botones en el frontend no
-- protege nada.

alter table public.profiles          enable row level security;
alter table public.clientes          enable row level security;
alter table public.productos         enable row level security;
alter table public.cotizaciones      enable row level security;
alter table public.cotizacion_items  enable row level security;
alter table public.quote_views       enable row level security;
alter table public.paquetes_folios   enable row level security;
alter table public.pagos             enable row level security;
alter table public.soporte_tickets   enable row level security;
alter table public.admin_team        enable row level security;
alter table public.email_templates   enable row level security;
alter table public.logs_sistema      enable row level security;
alter table public.config_plataforma enable row level security;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- El usuario edita su ficha, pero NO su saldo ni su rol: la cláusula WITH CHECK
-- compara contra el valor ya guardado, así que un UPDATE que intente cambiar
-- folios_balance o is_admin se rechaza. Ambos se modifican solo por función
-- SECURITY DEFINER (enviar_cotizacion, acreditar_folios).
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and folios_balance = (select folios_balance from public.profiles where id = auth.uid())
    and is_admin       = (select is_admin       from public.profiles where id = auth.uid())
  );

create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- clientes / productos — datos privados de cada usuario
-- ---------------------------------------------------------------
create policy clientes_own on public.clientes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy clientes_admin on public.clientes
  for select using (public.is_admin());

create policy productos_own on public.productos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy productos_admin on public.productos
  for select using (public.is_admin());

-- ---------------------------------------------------------------
-- cotizaciones
--
-- Sin acceso anónimo: el link público pasa por get_cotizacion_publica(), que
-- exige el token como argumento. Ver 0002_functions.sql.
-- ---------------------------------------------------------------
create policy cotizaciones_own on public.cotizaciones
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cotizaciones_admin on public.cotizaciones
  for select using (public.is_admin());

create policy cotizacion_items_own on public.cotizacion_items
  for all using (
    exists (select 1 from public.cotizaciones c
             where c.id = cotizacion_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.cotizaciones c
             where c.id = cotizacion_id and c.user_id = auth.uid())
  );
create policy cotizacion_items_admin on public.cotizacion_items
  for select using (public.is_admin());

-- quote_views: las escribe registrar_vista() (SECURITY DEFINER).
-- El dueño puede leer quién abrió su cotización.
create policy quote_views_owner on public.quote_views
  for select using (
    exists (select 1 from public.cotizaciones c
             where c.id = cotizacion_id and c.user_id = auth.uid())
    or public.is_admin()
  );

-- ---------------------------------------------------------------
-- paquetes_folios — catálogo público (la landing lo muestra sin login)
-- ---------------------------------------------------------------
create policy paquetes_public_read on public.paquetes_folios
  for select to anon, authenticated using (activo or public.is_admin());
create policy paquetes_admin_write on public.paquetes_folios
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- pagos — solo lectura para el dueño. Los escribe el webhook de Stripe
-- con service_role, que ignora RLS por diseño.
-- ---------------------------------------------------------------
create policy pagos_own_read on public.pagos
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------
-- soporte_tickets — el usuario crea y lee los suyos; el admin responde
-- ---------------------------------------------------------------
create policy soporte_own on public.soporte_tickets
  for select using (user_id = auth.uid() or public.is_admin());
create policy soporte_insert on public.soporte_tickets
  for insert with check (user_id = auth.uid());
create policy soporte_admin_update on public.soporte_tickets
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- Tablas exclusivas de administración
-- ---------------------------------------------------------------
create policy admin_team_only on public.admin_team
  for all using (public.is_admin()) with check (public.is_admin());

create policy email_templates_only on public.email_templates
  for all using (public.is_admin()) with check (public.is_admin());

create policy logs_admin_read on public.logs_sistema
  for select using (public.is_admin());

-- ---------------------------------------------------------------
-- config_plataforma
--
-- Solo admin. Las claves que la landing necesita sin login (WhatsApp de ventas,
-- etc.) se marcan publico = true y salen por la vista de abajo, para que el
-- resto de la tabla nunca viaje al navegador.
-- ---------------------------------------------------------------
create policy config_admin_only on public.config_plataforma
  for all using (public.is_admin()) with check (public.is_admin());

create or replace view public.config_publica
  with (security_invoker = false) as
  select clave, valor from public.config_plataforma where publico;

grant select on public.config_publica to anon, authenticated;
