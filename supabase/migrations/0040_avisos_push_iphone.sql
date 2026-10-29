-- Aplicada en Supabase como avisos_push_iphone (29-oct-2026).
-- App de iPhone: notificaciones cuando el cliente ABRE, ACEPTA o RECHAZA una
-- cotización (lo mismo que AvisosCliente muestra en el panel, pero con la app
-- cerrada). Cada teléfono guarda su token de APNs en dispositivos_push; un
-- disparador sobre cotizaciones llama a la función enviar-push.
-- El token del disparador vive SOLO en Vault; la función compara su sha256
-- (plataforma_secretos.push_sha256). La llave .p8 de Apple va en los secretos
-- de Edge Functions (APNS_KEY_P8, APNS_KEY_ID).
create extension if not exists pg_net;

create table if not exists public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  plataforma text not null default 'ios' check (plataforma in ('ios', 'android')),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index if not exists dispositivos_push_user_idx on public.dispositivos_push (user_id);

alter table public.dispositivos_push enable row level security;

drop policy if exists "dispositivos_push propios: ver" on public.dispositivos_push;
create policy "dispositivos_push propios: ver" on public.dispositivos_push
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "dispositivos_push propios: alta" on public.dispositivos_push;
create policy "dispositivos_push propios: alta" on public.dispositivos_push
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "dispositivos_push propios: cambio" on public.dispositivos_push;
create policy "dispositivos_push propios: cambio" on public.dispositivos_push
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "dispositivos_push propios: baja" on public.dispositivos_push;
create policy "dispositivos_push propios: baja" on public.dispositivos_push
  for delete to authenticated using (user_id = (select auth.uid()));

-- Si el mismo teléfono inicia sesión con otra cuenta, el token cambia de dueño
-- (el upsert por token lo reescribe): se permite solo con el user_id propio.
grant select, insert, update, delete on public.dispositivos_push to authenticated;

do $$
declare tok text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not exists (select 1 from vault.secrets where name = 'push_token') then
    perform vault.create_secret(tok, 'push_token', 'Token del disparador de enviar-push');
    insert into public.plataforma_secretos (clave, valor)
    values ('push_sha256', encode(extensions.digest(tok, 'sha256'), 'hex'))
    on conflict (clave) do update set valor = excluded.valor;
  end if;
end $$;

create or replace function public.avisar_push_cotizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado in ('vista', 'aceptada', 'rechazada')
     and new.estado is distinct from old.estado
     and exists (
       select 1 from public.dispositivos_push d
       join public.workspace_members m on m.user_id = d.user_id
       where m.workspace_id = new.workspace_id
     ) then
    perform net.http_post(
      url := 'https://mhvbsyacicntniapishp.supabase.co/functions/v1/enviar-push',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'push_token')),
      body := jsonb_build_object('cotizacion_id', new.id, 'estado', new.estado),
      timeout_milliseconds := 20000
    );
  end if;
  return new;
end $$;

revoke all on function public.avisar_push_cotizacion() from public, anon, authenticated;

drop trigger if exists avisar_push_cotizacion on public.cotizaciones;
create trigger avisar_push_cotizacion
  after update of estado on public.cotizaciones
  for each row execute function public.avisar_push_cotizacion();
