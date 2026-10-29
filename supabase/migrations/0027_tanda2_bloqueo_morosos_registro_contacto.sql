-- Aplicada en Supabase como 20261029010143_tanda2_bloqueo_morosos_registro_contacto.
-- Tanda 2 de la auditoría (29-oct-2026).

-- 1) Bloquear usuario SÍ quita el acceso. Antes admin_bloquear_usuario solo ponía
--    profiles.activo=false y nada lo revisaba.
create or replace function public.is_workspace_member(ws uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.workspace_members m
      join public.profiles p on p.id = m.user_id
     where m.workspace_id = ws and m.user_id = auth.uid() and m.activo and coalesce(p.activo, true)
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select is_admin and coalesce(activo, true) from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.admin_bloquear_usuario(uid uuid, bloquear boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Solo administradores'; end if;
  if uid = auth.uid() then raise exception 'No puedes bloquear tu propia cuenta'; end if;
  update public.profiles set activo = not bloquear where id = uid;
  -- Además impide iniciar sesión o renovar la sesión abierta.
  update auth.users set banned_until = case when bloquear then 'infinity'::timestamptz else null end where id = uid;
end $$;

-- 2) Un módulo con el cobro fallido ('morosa') solo sigue activo 7 días después
--    de que terminó el periodo pagado. Antes 'morosa' contaba como activo para siempre.
create or replace function public.modulo_activo(p_workspace uuid, p_clave text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.modulo_suscripciones
     where workspace_id = p_workspace and clave = p_clave
       and (estado = 'activa'
            or (estado = 'morosa'
                and coalesce(periodo_fin, ultimo_pago_at + interval '1 month', fecha_renovacion) + interval '7 days' > now()))
  );
$$;

-- 3) Duplicados al registrarse: la revisión pasa DENTRO del alta (protegida por el
--    captcha de Supabase Auth). Antes verificar_duplicado lo podía llamar cualquiera
--    sin cuenta y preguntar si un correo, nombre o teléfono ya es cliente.
create or replace function public.bloquear_registro_duplicado()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare nom text := lower(trim(coalesce(new.raw_user_meta_data->>'nombre', '')));
        tel text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'telefono', ''), '\D', '', 'g'), '');
begin
  if nom <> '' and exists (select 1 from public.profiles p where lower(trim(p.nombre)) = nom) then
    raise exception 'REGISTRO_DUPLICADO';
  end if;
  if tel is not null and (
       exists (select 1 from public.profiles p where nullif(regexp_replace(coalesce(p.telefono, ''), '\D', '', 'g'), '') = tel)
    or exists (select 1 from public.empresas e where nullif(regexp_replace(coalesce(e.telefono, ''), '\D', '', 'g'), '') = tel)
  ) then
    raise exception 'REGISTRO_DUPLICADO';
  end if;
  return new;
end $$;
drop trigger if exists antes_de_registrar on auth.users;
create trigger antes_de_registrar before insert on auth.users
  for each row execute function public.bloquear_registro_duplicado();

revoke all on function public.verificar_duplicado(uuid, text, text, text) from public, anon;
grant execute on function public.verificar_duplicado(uuid, text, text, text) to authenticated, service_role;

-- 4) Formulario de contacto: registro de envíos para limitar abusos (lo usa la
--    función contacto con service_role; nadie más lo lee).
create table if not exists public.contacto_envios (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists contacto_envios_ip_fecha on public.contacto_envios (ip_hash, created_at desc);
alter table public.contacto_envios enable row level security;
revoke all on public.contacto_envios from anon, authenticated;
