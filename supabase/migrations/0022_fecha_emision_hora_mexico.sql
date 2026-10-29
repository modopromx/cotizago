-- Aplicada en Supabase como 20261028202700_fecha_emision_hora_mexico.
-- La fecha de emisión se tomaba de CURRENT_DATE del servidor (UTC): una cotización
-- creada en México después de las 18:00 quedaba con la fecha del día siguiente.
alter table public.cotizaciones
  alter column fecha_emision set default ((now() at time zone 'America/Mexico_City')::date);
