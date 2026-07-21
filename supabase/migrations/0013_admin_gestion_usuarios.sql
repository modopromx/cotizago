-- CotizaGo — Gestión de usuarios por el superadmin.
-- Bloquear/activar (profiles.activo no está en los grants de columna del usuario).
create or replace function public.admin_bloquear_usuario(uid uuid, bloquear boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  update public.profiles set activo = not bloquear where id = uid;
end $$;
revoke all on function public.admin_bloquear_usuario(uuid, boolean) from public, anon;
grant execute on function public.admin_bloquear_usuario(uuid, boolean) to authenticated;
