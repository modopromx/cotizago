-- Aplicada en Supabase como 20261029010701_modulo_suscripciones_permite_morosa.
-- stripe-webhook marca 'morosa' cuando Stripe no puede cobrar, pero el CHECK no lo
-- permitía: la actualización fallaba en silencio y el módulo seguía 'activa' sin
-- pagar. Ahora 'morosa' es válido y modulo_activo le da 7 días de gracia.
alter table public.modulo_suscripciones drop constraint if exists modulo_suscripciones_estado_check;
alter table public.modulo_suscripciones add constraint modulo_suscripciones_estado_check
  check (estado = any (array['activa', 'pendiente_pago', 'cancelada', 'morosa']));
