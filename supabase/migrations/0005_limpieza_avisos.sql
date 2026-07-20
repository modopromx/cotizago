-- CotizaGo — Limpieza de avisos del linter de Supabase
-- Aplicado después de 0004. Arregla problemas que ya existían antes.

-- handle_new_user es un trigger de auth.users, no una API. Estaba expuesta como
-- endpoint REST (/rest/v1/rpc/handle_new_user) y cualquiera podía invocarla.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- is_admin solo tiene sentido con sesión iniciada.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- search_path fijo. Sin esto, quien pueda crear objetos en otro esquema podría
-- suplantar las funciones que estas llaman internamente y ejecutar su código
-- con los privilegios del dueño (estas son SECURITY DEFINER).
alter function public.handle_new_user() set search_path = public;
alter function public.update_updated_at() set search_path = public;
alter function public.generate_cotizacion_number(uuid) set search_path = public;

-- config_publica pasa de vista que ignora RLS a vista que respeta al usuario;
-- ahora es una política la que decide qué claves son legibles sin login.
create policy config_publico_read on public.config_plataforma
  for select to anon, authenticated using (publico);

drop view if exists public.config_publica;
create view public.config_publica with (security_invoker = true) as
  select clave, valor from public.config_plataforma where publico;
grant select on public.config_publica to anon, authenticated;
