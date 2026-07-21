-- CotizaGo — Distinguir factura fiscal (México) vs nota de remisión (otros países).
--
-- En México se emite CFDI (factura con PDF + XML). Fuera de México no hay CFDI,
-- así que se emite una nota de remisión con el RFC/ID fiscal del cliente para que
-- pueda deducirla localmente. Se guarda el tipo y el país en cada solicitud.

alter table public.facturas_solicitudes
  add column if not exists tipo text not null default 'factura'
    check (tipo in ('factura', 'nota_remision'));

alter table public.facturas_solicitudes
  add column if not exists pais text default 'MX';
