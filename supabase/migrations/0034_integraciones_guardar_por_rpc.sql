-- Aplicada en Supabase como integraciones_guardar_por_rpc (29-oct-2026).
-- El candado de lectura de integraciones.secreto rompía el guardado del panel
-- (el upsert ON CONFLICT DO UPDATE necesita SELECT en las columnas que toca).
-- El panel ahora guarda con esta función, que escribe la llave sin que el
-- navegador tenga que poder leerla.
create or replace function public.guardar_integracion(p_tipo text, p_config jsonb, p_secreto text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.profiles where id = auth.uid();
  if ws is null or not public.is_workspace_member(ws) then raise exception 'No autorizado'; end if;
  if p_tipo not in ('whatsapp', 'pagos', 'email') then raise exception 'Integración no válida'; end if;
  insert into public.integraciones (workspace_id, tipo, config, activa, secreto, updated_at)
  values (ws, p_tipo, coalesce(p_config, '{}'::jsonb), true, nullif(p_secreto, ''), now())
  on conflict (workspace_id, tipo) do update
    set config = excluded.config, activa = true, updated_at = now(),
        -- Solo se sobrescribe la llave si el usuario escribió una nueva.
        secreto = coalesce(nullif(p_secreto, ''), public.integraciones.secreto);
end $$;
revoke all on function public.guardar_integracion(text, jsonb, text) from public, anon;
grant execute on function public.guardar_integracion(text, jsonb, text) to authenticated;

-- Candado final (aplicar cuando el panel que usa guardar_integracion esté en línea):
--   revoke select on public.integraciones from authenticated, anon;
--   grant select (id, workspace_id, tipo, config, activa, created_at, updated_at, tiene_secreto)
--     on public.integraciones to authenticated;
