-- Aplicada en Supabase como eliminar_cuenta_automatico (29-oct-2026).
-- Borrado de cuenta inmediato y automático (requisito Google Play; decisión de Omar).
-- Los PAGOS se conservan por ley fiscal: ya no se borran en cascada con el
-- usuario; quedan desligados (user_id/workspace_id en null) con una marca.
alter table public.pagos alter column user_id drop not null;
alter table public.pagos drop constraint if exists pagos_user_id_fkey;
alter table public.pagos add constraint pagos_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.pagos drop constraint if exists pagos_workspace_id_fkey;
alter table public.pagos add constraint pagos_workspace_id_fkey foreign key (workspace_id) references public.workspaces(id) on delete set null;

-- Prepara el borrado: deja la cuenta lista para que al borrar el usuario de
-- auth todo lo demás caiga en cascada. Solo la llama la función eliminar-cuenta
-- (service role). Devuelve el workspace borrado (o null si no era el dueño).
create or replace function public.preparar_eliminacion_cuenta(p_user uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare ws uuid; es_dueno boolean; correo text;
begin
  select p.workspace_id, p.email into ws, correo from profiles p where p.id = p_user;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  if exists (select 1 from profiles where id = p_user and plan = 'superadmin') then
    raise exception 'La cuenta de administrador no se puede eliminar desde aquí';
  end if;
  select (w.owner_id = p_user) into es_dueno from workspaces w where w.id = ws;

  update pagos set user_id = null,
    workspace_id = case when es_dueno then null else workspace_id end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('cuenta_eliminada', jsonb_build_object('email', correo, 'workspace_id', ws, 'fecha', now()))
  where user_id = p_user or (es_dueno and workspace_id = ws);
  update facturas_solicitudes set user_id = null,
    workspace_id = case when es_dueno then null else workspace_id end
  where user_id = p_user or (es_dueno and workspace_id = ws);
  update soporte_tickets set user_id = null where user_id = p_user;
  update folio_transactions set created_by = null where created_by = p_user;

  if es_dueno then
    delete from folio_transactions where workspace_id = ws;
    delete from cotizaciones where workspace_id = ws;
    delete from clientes where workspace_id = ws;
    delete from productos where workspace_id = ws;
    delete from soporte_tickets where workspace_id = ws;
    delete from notificaciones where workspace_id = ws or user_id = p_user;
    delete from walinker_eventos where workspace_id = ws;
    delete from api_keys where workspace_id = ws;
    delete from modulo_suscripciones where workspace_id = ws;
    update profiles set workspace_id = null where workspace_id = ws and id <> p_user;
  else
    delete from notificaciones where user_id = p_user;
    update modulo_suscripciones set user_id = null where user_id = p_user;
  end if;
  return case when es_dueno then ws else null end;
end $$;
revoke all on function public.preparar_eliminacion_cuenta(uuid) from public, anon, authenticated;
