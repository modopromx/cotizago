-- Aplicada en Supabase como 20261028224425_facturables_clave_de_acceso.
-- Facturar solo desde la cuenta de cada quien (28-oct-2026). El folio (token) o
-- el # de pedido ya no bastan: el portal exige además
--   - compras de Cotiza Go (workspace_id): sesión iniciada del dueño;
--   - ventas de WooCommerce: la clave del pedido (order_key), que la tienda solo
--     muestra a su dueño en «Mi cuenta»;
--   - ventas por API: una clave aleatoria que la app solo enseña a su cliente.
alter table public.facturables add column if not exists clave_acceso text;
update public.facturables f
   set clave_acceso = encode(extensions.gen_random_bytes(24), 'hex')
 where clave_acceso is null and f.app_id is not null and f.workspace_id is null
   and exists (select 1 from public.facturacion_apps a where a.id = f.app_id and a.woo_url is null);

-- Página de «Mi cuenta» de la tienda: a donde manda el correo de «ya puedes facturar».
alter table public.facturacion_apps add column if not exists cuenta_url text;
