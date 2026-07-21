-- Cobro de módulos por suscripción mensual con Stripe.
--
-- Antes, ModulosPage insertaba directo en modulo_suscripciones y la política RLS
-- era ALL con with_check is_workspace_member(workspace_id): cualquier usuario
-- podía activarse un módulo gratis desde la consola del navegador. La activación
-- pasa a ser exclusiva del webhook de Stripe (service_role, que salta RLS).

-- 1) Datos de la suscripción en Stripe -----------------------------------------
alter table public.modulo_suscripciones
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id     text,
  add column if not exists modo                   text,   -- 'test' | 'live'
  add column if not exists cancelar_al_terminar   boolean not null default false,
  add column if not exists periodo_fin            timestamptz,
  add column if not exists ultimo_pago_at         timestamptz;

create unique index if not exists modulo_susc_stripe_sub_uidx
  on public.modulo_suscripciones (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.modulo_suscripciones.estado is
  'activa = pagada y vigente | morosa = falló el cobro, aún con acceso | cancelada = sin acceso';

-- El cliente de Stripe es distinto en prueba y en producción, así que se guarda
-- uno por modo. Si se mezclan, Stripe responde "No such customer".
alter table public.workspaces
  add column if not exists stripe_customer_test_id text,
  add column if not exists stripe_customer_live_id text;

-- 2) RLS: los usuarios LEEN sus suscripciones, pero no las escriben ------------
drop policy if exists mod_susc_ws on public.modulo_suscripciones;

create policy mod_susc_lectura on public.modulo_suscripciones
  for select using (is_workspace_member(workspace_id) or is_admin());

-- Sin políticas de INSERT/UPDATE/DELETE: solo service_role (webhook y edge
-- functions) puede escribir. Un usuario ya no puede regalarse un módulo.

-- 3) ¿Está activo un módulo? ---------------------------------------------------
-- Para que el resto de la app pregunte por acceso sin repetir la regla.
-- 'morosa' conserva el acceso: Stripe reintenta el cobro varios días y no se
-- corta el servicio al primer fallo.
create or replace function public.modulo_activo(p_workspace uuid, p_clave text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.modulo_suscripciones
     where workspace_id = p_workspace
       and clave = p_clave
       and estado in ('activa', 'morosa')
  );
$$;

revoke all on function public.modulo_activo(uuid, text) from public;
grant execute on function public.modulo_activo(uuid, text) to authenticated, service_role;
