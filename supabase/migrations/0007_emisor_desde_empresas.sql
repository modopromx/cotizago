-- CotizaGo — La cotización pública lee el emisor desde `empresas`, no `profiles`.
--
-- A partir del Sprint 2, "Mi empresa" (ConfiguracionPage) guarda los datos
-- fiscales en la tabla empresas (una por workspace). Esta función se actualiza
-- para leer de ahí, cayendo a profiles solo si aún no hay fila de empresa.

create or replace function public.get_cotizacion_publica(cotizacion_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  resultado jsonb;
begin
  select jsonb_build_object(
    'cotizacion', to_jsonb(c) - 'user_id' - 'cliente_id' - 'visto_ip',
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.orden)
        from public.cotizacion_items i
       where i.cotizacion_id = c.id), '[]'::jsonb),
    'emisor', jsonb_build_object(
      'nombre',        coalesce(e.nombre_comercial, e.razon_social, p.nombre, p.empresa),
      'empresa',       coalesce(e.nombre_comercial, p.empresa, p.nombre),
      'telefono',      coalesce(e.telefono, p.telefono),
      'email_empresa', coalesce(e.email, p.email_empresa),
      'banco',         coalesce(e.banco, p.banco),
      'titular',       coalesce(e.titular, p.titular),
      'clabe',         coalesce(e.clabe, p.clabe),
      'link_pago',     coalesce(e.link_pago, p.link_pago),
      'logo_url',      coalesce(e.logo_url, p.logo_url),
      'color_marca',   coalesce(e.color_principal, p.color_marca)
    )
  )
  into resultado
  from public.cotizaciones c
  join public.profiles p on p.id = c.user_id
  left join public.empresas e on e.workspace_id = c.workspace_id
  where c.token = cotizacion_token
    and c.estado <> 'borrador';

  return resultado;
end $$;
grant execute on function public.get_cotizacion_publica(text) to anon, authenticated;
