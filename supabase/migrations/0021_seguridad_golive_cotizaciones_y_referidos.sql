-- Aplicada en Supabase como 20261028201451_seguridad_golive_cotizaciones_y_referidos.
-- Auditoría de salida a producción (28-oct-2026).

-- 1) Candado de columnas de sistema en cotizaciones.
-- Desde el navegador (roles authenticated/anon) una cotización solo puede nacer
-- como BORRADOR, sin folio consumido y a nombre de quien la crea; y al editarla no
-- se puede marcar como enviada, cambiar dueño/empresa ni tocar respuesta/visitas.
-- Las funciones SECURITY DEFINER (enviar_cotizacion, guardar_cotizacion,
-- registrar_vista, responder_cotizacion) corren como su dueño y no pasan por aquí.
create or replace function public.proteger_cotizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id         := auth.uid();
    new.estado          := 'borrador';
    new.folio_consumido := false;
    new.enviada_at      := null;
    new.respuesta       := null;
    new.visto_at        := null;
    new.visto_count     := 0;
    new.visto_ip        := null;
    new.visto_pais      := null;
  else
    new.user_id         := old.user_id;
    new.workspace_id    := old.workspace_id;
    new.folio_consumido := old.folio_consumido;
    new.enviada_at      := old.enviada_at;
    new.respuesta       := old.respuesta;
    new.token           := old.token;
    new.visto_at        := old.visto_at;
    new.visto_count     := old.visto_count;
    new.visto_ip        := old.visto_ip;
    new.visto_pais      := old.visto_pais;
    -- El único cambio de estado permitido desde el navegador es cancelar.
    if new.estado is distinct from old.estado and new.estado <> 'cancelada' then
      new.estado := old.estado;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_cotizacion on public.cotizaciones;
create trigger trg_proteger_cotizacion
  before insert or update on public.cotizaciones
  for each row execute function public.proteger_cotizacion();

-- 2) Referidos: acreditar premios SOLO desde el servidor (stripe-webhook usa service_role).
revoke execute on function public.acreditar_referido(uuid) from public, anon, authenticated;
grant execute on function public.acreditar_referido(uuid) to service_role;

-- aplicar_referido: solo usuarios con sesión.
revoke execute on function public.aplicar_referido(text) from public, anon;
grant execute on function public.aplicar_referido(text) to authenticated;

-- modulo_activo: nadie sin sesión.
revoke execute on function public.modulo_activo(uuid, text) from public, anon;
grant execute on function public.modulo_activo(uuid, text) to authenticated, service_role;

-- 3) search_path fijo en las funciones del código de referido.
alter function public.gen_codigo_ref() set search_path = public;
alter function public.set_codigo_ref() set search_path = public;
