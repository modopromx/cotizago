-- CotizaGo — Funciones de servidor
-- Todo lo que el navegador NO debe poder decidir por su cuenta vive aquí.

-- ---------------------------------------------------------------
-- ¿el usuario actual es admin?
-- SECURITY DEFINER para que no dispare las políticas RLS de profiles
-- (si leyera profiles con RLS activo, la política de profiles se llamaría
--  a sí misma y Postgres aborta por recursión infinita).
-- ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------
-- Crear el profile automáticamente al registrarse
-- Antes esto lo hacía RegisterPage desde el navegador; si el insert fallaba,
-- quedaba un usuario en auth.users sin profile y la app quedaba en blanco.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, empresa, folios_balance)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'empresa',
    5  -- folios de cortesía al registrarse
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Número consecutivo de cotización por usuario (COT-0001, COT-0002, ...)
-- ---------------------------------------------------------------
create or replace function public.generate_cotizacion_number(user_uuid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  siguiente integer;
begin
  select coalesce(max((regexp_replace(numero, '\D', '', 'g'))::integer), 0) + 1
    into siguiente
    from public.cotizaciones
   where user_id = user_uuid
     and numero ~ '^COT-\d+$';

  return 'COT-' || lpad(siguiente::text, 4, '0');
end $$;

-- ---------------------------------------------------------------
-- Enviar cotización: descuenta el folio de forma atómica.
--
-- Esto reemplaza el patrón anterior de NuevaCotizacionPage.tsx:109, donde el
-- navegador leía el saldo, restaba 1 y escribía el resultado. Cualquiera con
-- la consola abierta podía escribir el saldo que quisiera.
--
-- Aquí el saldo se resta en la base de datos con un UPDATE condicional; el
-- cliente nunca envía la cifra nueva. Si no hay folios, la operación falla
-- entera y la cotización no se marca como enviada.
-- ---------------------------------------------------------------
create or replace function public.enviar_cotizacion(cotizacion_uuid uuid)
returns public.cotizaciones
language plpgsql
security definer
set search_path = public
as $$
declare
  cot     public.cotizaciones;
  saldo   integer;
begin
  -- bloquea la fila para que dos pestañas simultáneas no gasten el mismo folio
  select * into cot
    from public.cotizaciones
   where id = cotizacion_uuid
     and user_id = auth.uid()
   for update;

  if cot is null then
    raise exception 'Cotización no encontrada' using errcode = 'no_data_found';
  end if;

  if cot.folio_consumido then
    return cot;  -- ya se envió; no cobrar dos veces
  end if;

  update public.profiles
     set folios_balance = folios_balance - 1
   where id = auth.uid()
     and folios_balance >= 1
  returning folios_balance into saldo;

  if saldo is null then
    raise exception 'Sin folios disponibles' using errcode = 'check_violation';
  end if;

  update public.cotizaciones
     set estado          = 'enviada',
         folio_consumido = true,
         enviada_at      = now()
   where id = cotizacion_uuid
  returning * into cot;

  return cot;
end $$;

-- ---------------------------------------------------------------
-- Registrar apertura del link público.
--
-- Antes CotizacionPublicaPage escribía directo sobre cotizaciones para subir
-- visto_count, lo que obligaba a dar UPDATE público sobre la tabla — es decir,
-- cualquiera podía editar el total de cualquier cotización. Ahora la única
-- escritura pública permitida es esta función, que solo toca los contadores.
-- ---------------------------------------------------------------
create or replace function public.registrar_vista(cotizacion_token text, ua text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cot_id uuid;
begin
  select id into cot_id from public.cotizaciones where token = cotizacion_token;
  if cot_id is null then return; end if;

  insert into public.quote_views (cotizacion_id, user_agent) values (cot_id, ua);

  update public.cotizaciones
     set visto_count = visto_count + 1,
         visto_at    = coalesce(visto_at, now()),
         estado      = case when estado = 'enviada' then 'vista' else estado end
   where id = cot_id;
end $$;

-- ---------------------------------------------------------------
-- Respuesta del cliente (aceptar / rechazar) desde el link público.
-- Solo permite esas dos transiciones y solo si la cotización sigue abierta.
-- ---------------------------------------------------------------
create or replace function public.responder_cotizacion(cotizacion_token text, respuesta_cliente text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if respuesta_cliente not in ('aceptada','rechazada') then
    raise exception 'Respuesta inválida';
  end if;

  update public.cotizaciones
     set estado    = respuesta_cliente,
         respuesta = respuesta_cliente
   where token  = cotizacion_token
     and estado in ('enviada','vista');
end $$;

-- ---------------------------------------------------------------
-- Acreditar folios tras un pago aprobado.
-- La llama el webhook de Stripe (Edge Function con service_role), nunca el navegador.
-- ---------------------------------------------------------------
create or replace function public.acreditar_folios(pago_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.pagos;
begin
  select * into p from public.pagos where id = pago_uuid for update;

  if p is null or p.estado = 'aprobado' then
    return;  -- idempotente: Stripe reintenta webhooks
  end if;

  update public.pagos set estado = 'aprobado' where id = pago_uuid;

  update public.profiles
     set folios_balance = folios_balance + p.folios
   where id = p.user_id;
end $$;

-- ---------------------------------------------------------------
-- Leer una cotización desde el link público.
--
-- Se resuelve con una función y no con políticas RLS a propósito: una política
-- que permita a anon leer `cotizaciones` no puede exigir "solo la fila cuyo
-- token conoces" — el filtro por token lo pone el cliente en el WHERE, y quien
-- quite ese WHERE se lleva la tabla entera. Aquí el token es un argumento
-- obligatorio y solo se devuelven los campos del emisor que deben ser públicos
-- (nunca numero_cuenta, ni el saldo de folios, ni el email personal).
-- ---------------------------------------------------------------
create or replace function public.get_cotizacion_publica(cotizacion_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  resultado jsonb;
begin
  select jsonb_build_object(
    'cotizacion', to_jsonb(c) - 'user_id' - 'cliente_id',
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.orden)
        from public.cotizacion_items i
       where i.cotizacion_id = c.id
    ), '[]'::jsonb),
    'emisor', jsonb_build_object(
      'nombre',        p.nombre,
      'empresa',       p.empresa,
      'telefono',      p.telefono,
      'email_empresa', p.email_empresa,
      'banco',         p.banco,
      'titular',       p.titular,
      'clabe',         p.clabe,
      'link_pago',     p.link_pago,
      'logo_url',      p.logo_url,
      'color_marca',   p.color_marca
    )
  )
  into resultado
  from public.cotizaciones c
  join public.profiles p on p.id = c.user_id
  where c.token = cotizacion_token
    and c.estado <> 'borrador';  -- un borrador nunca es público

  return resultado;  -- null si no existe: la página muestra "no encontrada"
end $$;

-- Permisos: estas son las únicas funciones que el cliente puede invocar.
revoke all on function public.enviar_cotizacion(uuid)      from public, anon;
revoke all on function public.acreditar_folios(uuid)       from public, anon, authenticated;
grant execute on function public.enviar_cotizacion(uuid)             to authenticated;
grant execute on function public.generate_cotizacion_number(uuid)    to authenticated;
grant execute on function public.registrar_vista(text, text)         to anon, authenticated;
grant execute on function public.responder_cotizacion(text, text)    to anon, authenticated;
grant execute on function public.is_admin()                          to authenticated;
grant execute on function public.get_cotizacion_publica(text)        to anon, authenticated;
