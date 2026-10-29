-- Aplicada en Supabase como facturacion_apps_grupo (29-oct-2026).
-- Apps del hub que venden lo MISMO por dos caminos (Fidelízalo: tienda Woo + panel
-- de negocios). Un pago (misma referencia_externa) se factura UNA sola vez en el grupo:
-- facturacion-api, facturar y facturacion buscan en todas las apps del grupo.
alter table public.facturacion_apps add column if not exists grupo text;
update public.facturacion_apps set grupo = 'fidelizalo'
 where id in ('f9666130-863d-4cd2-bcec-de5f1b2d13c2', '715a3816-9e68-4804-a7b8-ae4230e8dee0');

-- Ids de las apps del mismo grupo (incluida ella misma).
create or replace function public.apps_del_grupo(p_app uuid)
returns uuid[] language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select array_agg(b.id) from facturacion_apps a join facturacion_apps b on b.grupo = a.grupo
      where a.id = p_app and a.grupo is not null),
    array[p_app])
$$;
revoke all on function public.apps_del_grupo(uuid) from public, anon, authenticated;
