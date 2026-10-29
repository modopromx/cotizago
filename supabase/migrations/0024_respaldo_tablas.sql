-- Aplicada en Supabase como 20261028221511_respaldo_tablas_y_token.
-- Lista de tablas de public para la función `respaldo` (solo service_role).
create or replace function public.respaldo_tablas()
returns table (tabla text)
language sql
security definer
set search_path to ''
as $$
  select table_name::text from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
   order by table_name
$$;
revoke all on function public.respaldo_tablas() from public, anon, authenticated;
grant execute on function public.respaldo_tablas() to service_role;

-- La migración original también sembraba plataforma_secretos.respaldo_token; se
-- reemplazó a mano por respaldo_token_sha256 (solo la huella; la llave vive en la
-- computadora de Omar). No se repite aquí para no volver a crear una llave en la base.
