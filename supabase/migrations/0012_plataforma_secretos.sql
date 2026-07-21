-- CotizaGo — Bóveda de secretos de plataforma (Stripe, SMTP password…).
--
-- El admin puede ESCRIBIR sus credenciales desde el panel, pero NO puede volver
-- a leer el valor por la API (no hay policy de SELECT para authenticated). Solo
-- las Edge Functions, con service_role (bypass RLS), leen los secretos. El panel
-- ve únicamente el ESTADO (configurado / no) vía secretos_configurados().

create table if not exists public.plataforma_secretos (
  clave      text primary key,
  valor      text not null,
  updated_at timestamptz not null default now()
);

alter table public.plataforma_secretos enable row level security;

-- El admin puede escribir (insert/update). Deliberadamente SIN policy de select:
-- ni el admin puede leer el valor de vuelta por la API.
create policy secretos_insert on public.plataforma_secretos
  for insert to authenticated with check (public.is_admin());
create policy secretos_update on public.plataforma_secretos
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant insert, update on public.plataforma_secretos to authenticated;
grant select on public.plataforma_secretos to service_role;

-- Estado de los secretos (solo booleans), para que el panel muestre "configurado ✓".
create or replace function public.secretos_configurados()
returns jsonb language sql security definer stable set search_path = public as $$
  select case when public.is_admin() then
    coalesce((select jsonb_object_agg(clave, (valor is not null and length(valor) > 0))
              from public.plataforma_secretos), '{}'::jsonb)
  else '{}'::jsonb end;
$$;
revoke all on function public.secretos_configurados() from public, anon;
grant execute on function public.secretos_configurados() to authenticated;
