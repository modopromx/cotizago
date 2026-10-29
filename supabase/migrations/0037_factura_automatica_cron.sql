-- Aplicada en Supabase como factura_automatica_cron (29-oct-2026).
-- Cada hora (minuto 7) se reintentan las facturas automáticas que esperan timbres
-- y los pagos cobrados que se quedaron sin facturar.
-- El token del cron vive SOLO en Vault; la función compara su sha256
-- (plataforma_secretos.factura_cron_sha256).
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare tok text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not exists (select 1 from vault.secrets where name = 'factura_cron_token') then
    perform vault.create_secret(tok, 'factura_cron_token', 'Token del cron de factura-automatica');
    insert into public.plataforma_secretos (clave, valor)
    values ('factura_cron_sha256', encode(extensions.digest(tok, 'sha256'), 'hex'))
    on conflict (clave) do update set valor = excluded.valor;
  end if;
end $$;

select cron.unschedule('factura-automatica-reintento') where exists (select 1 from cron.job where jobname = 'factura-automatica-reintento');
select cron.schedule('factura-automatica-reintento', '7 * * * *', $cron$
  select net.http_post(
    url := 'https://mhvbsyacicntniapishp.supabase.co/functions/v1/factura-automatica',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'factura_cron_token')),
    body := '{"accion":"reintentar"}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
