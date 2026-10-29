-- Aplicada en Supabase como detalles_seguridad_menores (29-oct-2026).

-- 1) Soporte: solo se escribe en tickets de TU cuenta. Antes bastaba poner tu
--    workspace_id y el ticket_id de otra cuenta para meter mensajes en su ticket.
drop policy if exists soporte_mensajes_insert on public.soporte_mensajes;
create policy soporte_mensajes_insert on public.soporte_mensajes for insert
  with check (
    is_admin()
    or (es_admin = false and user_id = auth.uid() and is_workspace_member(workspace_id)
        and exists (select 1 from public.soporte_tickets t
                     where t.id = soporte_mensajes.ticket_id and t.workspace_id = soporte_mensajes.workspace_id))
  );

-- 2) «Pagar en línea»: solo enlaces http(s). Un javascript: o data: no se guarda.
alter table public.empresas drop constraint if exists empresas_link_pago_http;
alter table public.empresas add constraint empresas_link_pago_http
  check (link_pago is null or link_pago = '' or link_pago ~* '^https?://');

-- 3) Cotización pública: no devuelve datos internos (cuenta, visitas, enlace de
--    WhatsApp, estado del folio); enlace de pago solo http(s) y color solo #RRGGBB.
create or replace function public.get_cotizacion_publica(cotizacion_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare resultado jsonb;
begin
  select jsonb_build_object(
    'cotizacion', to_jsonb(c) - 'user_id' - 'cliente_id' - 'visto_ip' - 'workspace_id' - 'visto_count'
                  - 'visto_at' - 'visto_pais' - 'wa_link' - 'folio_consumido' - 'enviada_at',
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.orden) from public.cotizacion_items i where i.cotizacion_id = c.id), '[]'::jsonb),
    'emisor', jsonb_build_object(
      'nombre',        coalesce(e.nombre_comercial, e.razon_social, p.nombre, p.empresa),
      'empresa',       coalesce(e.nombre_comercial, p.empresa, p.nombre),
      'telefono',      coalesce(e.telefono, p.telefono),
      'email_empresa', coalesce(e.email, p.email_empresa),
      'banco',         coalesce(e.banco, p.banco),
      'titular',       coalesce(e.titular, p.titular),
      'clabe',         coalesce(e.clabe, p.clabe),
      'link_pago',     case when coalesce(e.link_pago, p.link_pago) ~* '^https?://' then coalesce(e.link_pago, p.link_pago) end,
      'logo_url',      coalesce(e.logo_url, p.logo_url),
      'color_marca',   case when coalesce(e.color_principal, p.color_marca) ~* '^#[0-9a-f]{6}$' then coalesce(e.color_principal, p.color_marca) end
    )
  ) into resultado
  from public.cotizaciones c
  join public.profiles p on p.id = c.user_id
  left join public.empresas e on e.workspace_id = c.workspace_id
  where c.token = cotizacion_token and c.estado <> 'borrador';
  return resultado;
end $function$;

-- 4) Contraseñas guardadas: el navegador puede escribirlas pero no leerlas.
revoke select on public.email_conexiones from authenticated, anon;
grant select (id, workspace_id, host, puerto, usuario, from_email, from_nombre, activa, created_at, updated_at)
  on public.email_conexiones to authenticated;
alter table public.integraciones add column if not exists tiene_secreto boolean
  generated always as (coalesce(secreto, '') <> '') stored;

-- PENDIENTE (cuando el panel nuevo esté en línea, porque el viejo pide select *):
--   revoke select on public.integraciones from authenticated, anon;
--   grant select (id, workspace_id, tipo, config, activa, created_at, updated_at, tiene_secreto)
--     on public.integraciones to authenticated;
