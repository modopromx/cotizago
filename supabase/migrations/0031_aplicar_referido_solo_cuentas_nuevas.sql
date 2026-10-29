-- Aplicada en Supabase como 20261029011508_aplicar_referido_solo_cuentas_nuevas.
-- El código de invitación solo se aplica al registrarse (cuenta creada hace menos
-- de 24 h). Antes cualquier cuenta vieja podía «hacerse referida» de otra cuenta
-- propia y cobrar los bonos en su siguiente compra.
create or replace function public.aplicar_referido(codigo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare ref_id uuid; me uuid := auth.uid(); creada timestamptz;
begin
  if me is null then return jsonb_build_object('ok', false, 'motivo', 'no_auth'); end if;
  select created_at into creada from auth.users where id = me;
  if creada is null or creada < now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'motivo', 'cuenta_existente');
  end if;
  if exists (select 1 from profiles where id = me and referido_por is not null) then
    return jsonb_build_object('ok', false, 'motivo', 'ya_referido');
  end if;
  select id into ref_id from profiles where upper(codigo_ref) = upper(trim(codigo));
  if ref_id is null then return jsonb_build_object('ok', false, 'motivo', 'codigo_invalido'); end if;
  if ref_id = me then return jsonb_build_object('ok', false, 'motivo', 'auto'); end if;
  update profiles set referido_por = ref_id where id = me;
  insert into referidos (referrer_id, referido_id, estado) values (ref_id, me, 'pendiente')
    on conflict (referido_id) do nothing;
  return jsonb_build_object('ok', true);
end $function$;
