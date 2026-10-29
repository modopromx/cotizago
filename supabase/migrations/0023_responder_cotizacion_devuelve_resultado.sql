-- Aplicada en Supabase como 20261028214704_responder_cotizacion_devuelve_resultado.
-- La página pública confirmaba «respuesta registrada» aunque no se guardara nada
-- (cotización ya respondida, cancelada o token inválido). Ahora devuelve si se
-- registró, para que la página pueda decirlo.
drop function if exists public.responder_cotizacion(text, text);
create function public.responder_cotizacion(cotizacion_token text, respuesta_cliente text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if respuesta_cliente not in ('aceptada','rechazada') then
    raise exception 'Respuesta invalida';
  end if;
  update public.cotizaciones
     set estado = respuesta_cliente, respuesta = respuesta_cliente
   where token = cotizacion_token and estado in ('enviada','vista');
  return found;
end $function$;
grant execute on function public.responder_cotizacion(text, text) to anon, authenticated, service_role;
