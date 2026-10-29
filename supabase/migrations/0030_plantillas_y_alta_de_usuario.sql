-- Aplicadas en Supabase como 20261029010219_handle_new_user_guarda_telefono y
-- 20261029011440_plantilla_whatsapp_por_defecto (aquí la versión final de handle_new_user).

-- 5 de 6 cuentas no tenían ninguna plantilla y la página salía vacía. Cada cuenta
-- recibe la plantilla de WhatsApp de envío inicial (la que de verdad se usa al
-- enviar), también las cuentas nuevas desde el registro.
create or replace function public.sembrar_plantillas(ws uuid)
returns void language sql security definer set search_path to 'public' as $$
  insert into public.plantillas_mensajes (workspace_id, canal, momento, nombre, cuerpo)
  values (ws, 'whatsapp', 'envio_inicial', 'WhatsApp · Envío inicial',
          E'Hola {{cliente}} 👋\n\nTe comparto la cotización {{folio}} por un total de {{total}}.\n\nPuedes revisarla y confirmar desde aquí:\n{{enlace_publico}}\n\nQuedo atento a tus comentarios.')
  on conflict (workspace_id, canal, momento) do nothing;
$$;
revoke all on function public.sembrar_plantillas(uuid) from public, anon, authenticated;

select public.sembrar_plantillas(id) from public.workspaces;

-- Alta de usuario: el teléfono del registro se guarda desde el alta (antes lo
-- escribía el navegador después, y dos registros seguidos con el mismo número no
-- se detectaban) y se siembra la plantilla de WhatsApp.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare ws_id uuid;
begin
  insert into public.profiles (id, email, nombre, empresa, telefono, folios_balance)
  values (new.id, new.email, new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'empresa',
          nullif(new.raw_user_meta_data->>'telefono', ''), 5)
  on conflict (id) do nothing;
  insert into public.workspaces (nombre, owner_id, folios_balance)
  values (coalesce(new.raw_user_meta_data->>'empresa', new.raw_user_meta_data->>'nombre', 'Mi empresa'), new.id, 5)
  returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, rol) values (ws_id, new.id, 'owner');
  update public.profiles set workspace_id = ws_id where id = new.id;
  insert into public.empresas (workspace_id, nombre_comercial, email) values (ws_id, new.raw_user_meta_data->>'empresa', new.email);
  insert into public.folio_transactions (workspace_id, tipo, folios, saldo_resultante, referencia, created_by)
  values (ws_id, 'saldo_inicial', 5, 5, 'Folios de cortesía al registrarse', new.id);
  perform public.sembrar_plantillas(ws_id);
  return new;
end $function$;
