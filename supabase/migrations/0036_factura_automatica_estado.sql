-- Aplicada en Supabase como factura_automatica_estado (29-oct-2026).
-- Estado de la factura automática de cada pago (factura-automatica):
--   en_espera_timbres = se acabaron los timbres de SENHUB; se reintenta cada hora
--   error             = SENHUB la rechazó (auto_error trae el motivo)
--   generada          = CFDI timbrado sin que el cliente lo pidiera
alter table public.facturables add column if not exists auto_estado text
  check (auto_estado in ('en_espera_timbres', 'error', 'generada'));
alter table public.facturables add column if not exists auto_error text;
alter table public.facturables add column if not exists auto_intentos int not null default 0;
create index if not exists facturables_auto_espera on public.facturables (auto_estado) where auto_estado = 'en_espera_timbres';
