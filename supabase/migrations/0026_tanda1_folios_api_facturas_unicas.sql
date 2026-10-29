-- Aplicada en Supabase como 20261028235013_tanda1_folios_api_facturas_unicas.
-- Tanda 1 de la auditoría (28-oct-2026).

-- 1) Llaves de API: solo puedes crear/editar llaves a TU nombre. Antes el WITH CHECK
--    solo pedía ser miembro del workspace: se podía crear una llave con el user_id de
--    otra persona y gastar sus folios por la API.
drop policy if exists api_keys_ws on public.api_keys;
create policy api_keys_ws on public.api_keys for all
  using (is_workspace_member(workspace_id) or is_admin())
  with check ((is_workspace_member(workspace_id) and user_id = auth.uid()) or is_admin());

-- 2) Cobro de folio de la API, atómico (antes: leer saldo, crear, y restar saldo-1;
--    dos peticiones a la vez creaban dos cotizaciones con un solo folio).
create or replace function public.consumir_folio_api(cotizacion_uuid uuid, usuario uuid, referencia text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare cot public.cotizaciones; saldo integer;
begin
  select * into cot from public.cotizaciones where id = cotizacion_uuid and user_id = usuario for update;
  if cot is null then raise exception 'Cotización no encontrada'; end if;
  if cot.folio_consumido then
    select folios_balance into saldo from public.profiles where id = usuario;
    return saldo;
  end if;
  update public.profiles set folios_balance = folios_balance - 1
   where id = usuario and folios_balance >= 1 returning folios_balance into saldo;
  if saldo is null then raise exception 'Sin folios disponibles'; end if;
  update public.workspaces set folios_balance = greatest(folios_balance - 1, 0) where id = cot.workspace_id;
  update public.cotizaciones set estado = 'enviada', folio_consumido = true, enviada_at = now() where id = cotizacion_uuid;
  insert into public.folio_transactions (workspace_id, tipo, folios, saldo_resultante, referencia, cotizacion_id, created_by)
  values (cot.workspace_id, 'consumo', -1, saldo, referencia, cot.id, usuario);
  return saldo;
end $$;
revoke all on function public.consumir_folio_api(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consumir_folio_api(uuid, uuid, text) to service_role;

-- 3) Un solo facturable por pedido de tienda y por pago de Cotiza Go (reintentos del
--    webhook o dos clics ya no crean duplicados).
create unique index if not exists facturables_app_ref_uidx
  on public.facturables (app_id, referencia_externa) where referencia_externa is not null;
create unique index if not exists facturables_pago_uidx
  on public.facturables (pago_id) where pago_id is not null;

-- 4) Candado de timbrado: marca el facturable 'timbrando' antes de llamar a SENHUB.
--    Si ya está facturado o lo está timbrando otra petición (<10 min), devuelve false.
alter table public.facturables add column if not exists timbrando_at timestamptz;
create or replace function public.reservar_timbrado(facturable uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.facturables
     set estado = 'timbrando', timbrando_at = now()
   where id = facturable
     and (estado = 'pendiente' or (estado = 'timbrando' and timbrando_at < now() - interval '10 minutes'));
  return found;
end $$;
revoke all on function public.reservar_timbrado(uuid) from public, anon, authenticated;
grant execute on function public.reservar_timbrado(uuid) to service_role;
