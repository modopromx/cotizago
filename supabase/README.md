# Base de datos de CotizaGo

Proyecto Supabase: `mhvbsyacicntniapishp` (org ModoPro, región us-west-2).

## Estado

`migrations/` contiene **solo lo que está realmente aplicado** en la base:

| Archivo | Qué hace |
|---|---|
| `0004_seguridad.sql` | RLS en las 15 tablas, rol `is_admin`, descuento atómico de folios, acceso público por función |
| `0005_limpieza_avisos.sql` | Cierra `handle_new_user` como endpoint REST, fija `search_path`, `config_publica` respeta RLS |
| `0006_workspaces_fundacion.sql` | **Sprint 0.** Capa multi-tenant: `workspaces`, `workspace_members`, `empresas`, `folio_transactions`. `workspace_id` en todas las tablas de datos (aditivo, con trigger de autorelleno). RLS repunteado a membresía de workspace. Precios de paquetes al diseño (Emprende 25/$199, Negocio 100/$499, Pro 300/$999). |

## Modelo multi-tenant (desde Sprint 0)

- Un **workspace** es la cuenta de negocio. Tiene un `owner_id` y miembros en
  `workspace_members` (roles: owner / admin / member).
- Cada usuario tiene `profiles.workspace_id` = su workspace activo. Un trigger
  rellena `workspace_id` en los INSERT que no lo traen, para que el frontend
  actual (que solo manda `user_id`) siga funcionando sin cambios.
- **Folios**: el saldo sigue en `profiles.folios_balance` y se refleja en
  `workspaces.folios_balance` (hoy 1:1). `folio_transactions` es el libro
  auditable de cada movimiento. Cuando existan equipos reales, el saldo se
  promueve al workspace (cambio trivial, sin datos en riesgo).
- Los datos fiscales de la empresa emisora pasaron de `profiles` a `empresas`
  (uno por workspace). Los campos viejos en `profiles` siguen ahí; se limpian
  cuando el frontend deje de leerlos (Sprint 2).

No hay migrations 0001–0003 aquí a propósito. Ver abajo.

## Por qué faltan las migrations 0001–0003

El esquema de las tablas **nunca estuvo en git**: vivía solo en el dashboard de
Supabase. Cuando el proyecto se pausó por inactividad y pareció borrado, se
reconstruyó el esquema leyendo las columnas que menciona el código de `src/`.

Después resultó que el proyecto solo estaba pausado, no eliminado, y las tablas
seguían intactas. Esas migrations reconstruidas quedaron obsoletas antes de
aplicarse, y **no coinciden con la base real** — les faltan `notificaciones`,
`facturas_solicitudes`, y las columnas `visto_ip`, `visto_pais` y `pago_*` de
`cotizaciones`.

Están guardadas en `_reconstruido_sin_aplicar/` como referencia histórica.
**No las ejecutes**: crearían un esquema distinto al que tienes.

## Regla que originó todo esto

El esquema vive en el dashboard, no en el repo. Mientras siga así, el repo no
sirve de respaldo. Antes de tener clientes reales conviene exportarlo con
`supabase db pull`, para que un `git clone` baste para reconstruir todo.

## Pendiente

- **Activar "Leaked Password Protection"** en Authentication → Policies. Es un
  interruptor del dashboard, no se puede hacer por SQL.
- **Evitar la pausa por inactividad**: el plan gratuito apaga el proyecto tras
  7 días sin consultas. Un cron que haga una petición cada 2 días lo evita.

## Cómo se marca un admin

Ya no se usa `VITE_ADMIN_EMAILS` (iba dentro del bundle público y era visible
para cualquiera). El rol vive en la base:

```sql
update public.profiles set is_admin = true where email = 'alguien@ejemplo.com';
```
