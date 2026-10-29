-- Aplicada en Supabase como 20261029011329_registrar_vista_ignora_al_dueno.
-- Abrir la cotización desde el propio panel («Ver») la marcaba como «Vista» por el
-- cliente y sumaba visitas falsas. Si quien abre el enlace tiene sesión y es de la
-- misma cuenta, no se cuenta.
create or replace function public.registrar_vista(cotizacion_token text, ua text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare cot_id uuid; ws uuid;
begin
  select id, workspace_id into cot_id, ws from public.cotizaciones where token = cotizacion_token;
  if cot_id is null then return; end if;
  if auth.uid() is not null and public.is_workspace_member(ws) then return; end if;
  insert into public.quote_views (cotizacion_id, user_agent) values (cot_id, ua);
  update public.cotizaciones
     set visto_count = coalesce(visto_count, 0) + 1,
         visto_at    = coalesce(visto_at, now()),
         estado      = case when estado = 'enviada' then 'vista' else estado end
   where id = cot_id;
end $function$;
