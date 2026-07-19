# Kontify — Fundación (Design Spec)

Fecha: 2026-07-19 · Estado: aprobado a nivel de diseño, pendiente plan de implementación.

## Contexto

Kontify es un SaaS administrativo multi-tenant para emprendimientos y pymes de **cualquier país** (no fiscal): controla inventario, ventas, compras, finanzas, clientes, vendedores y cajeros. Debe funcionar para farmacia, ferretería, tienda de ropa, almacén mayor/detal, restaurante, etc. Inspiraciones: Fina, Cuadra (UI limpia/simple), Cachicamo (manual de uso). Objetivo: superarlas en UX/UI.

Este spec cubre **solo la Fundación**: la base sobre la que se construyen todos los módulos. El proyecto completo se descompone en sub-proyectos independientes (ver "Alcance y descomposición"), cada uno con su propio spec.

## Alcance y descomposición

**Fundación (este spec):** arquitectura multi-tenant, auth, subdominios, roles, multi-sucursal, sistema de diseño y app shell (dual-tier + dashboard).

**Sub-proyectos posteriores (spec propio cada uno):**
- Módulos operativos: Clientes → Productos → Facturación → Presupuestos → Reportes (Inventario, Ventas) → Finanzas (CxP, CxC, Comisiones, Bancos, Gastos)
- Super-admin (licencias, pagos, activación de módulos, clientes de la plataforma)
- Landing pública + SEO + testimonios + planes + FAQ + sitemap + Google Ads
- Módulos premium de pago aparte: Marketing, RRHH, Contabilidad

## Decisiones de arquitectura

### Stack y despliegue
- Next.js (App Router) + TypeScript + Tailwind.
- Supabase **Cloud** (Postgres + Auth + Storage + RLS).
- Despliegue con Coolify en Hetzner; repo en GitHub (igual que los demás proyectos del usuario).
- Iconos: Lucide.

### Multi-tenancy — una BD + RLS
- Una sola base Postgres. Cada fila lleva `tenant_id`.
- Aislamiento por **Row Level Security de Supabase**: a nivel de motor es imposible que un tenant vea datos de otro. (Elegido sobre schema-por-tenant y BD-por-tenant por costo/mantenimiento; RLS da el aislamiento sin la carga operativa.)
- Sucursales: tabla `branches` con `tenant_id`. Los datos operativos llevan `branch_id`.

### Subdominios
- `cliente.kontify.app` mediante DNS wildcard + middleware de Next.js que lee el subdominio y resuelve el `tenant_id` de la sesión.
- Landing pública y registro en `kontify.app` / `www`.

### Roles y permisos
- **Plataforma:** `SUPER_ADMIN` (gestiona todos los tenants, licencias, pagos, módulos).
- **Tenant:**
  - `OWNER` y `ADMIN` — operación completa, todas las sucursales, reportes consolidados.
  - `ADMINISTRATIVO` — back-office: Clientes, Facturación, Presupuestos, Reportes y todo Finanzas; ve todas las sucursales. **No** opera caja/POS ni el billing de la suscripción.
  - `VENDEDOR`, `CAJERO`, `ALMACÉN` — **scoped a su sucursal**.
- Enforcement: RLS por `tenant_id`/`branch_id` + checks de rol en cada endpoint.

### Seguridad (requisito del usuario)
- Revisión por un agente full-stack senior antes de producción: nada sensible expuesto en el front, todas las consultas pasan por RLS, validación con **Zod** en cada endpoint, secretos solo server-side, auditoría de accesos, defensa ante ataques comunes.

## Diseño UX/UI

Ver el documento completo y autoritativo en `docs/design/design-system.md`. Resumen:
- Marca **Kontify**; paleta **Teal & Slate** con modo claro/oscuro obligatorio.
- **Navegación dual-tier** (riel de iconos oscuro nivel 1 + panel de sub-nav claro nivel 2), toggle nativo "panel-left" en el top bar, **FAB "+" squircle** de venta rápida.
- **Móvil**: barra inferior (Inicio · Vender · **+** squircle · Inventario · Más); top bar = sucursal + campana; **perfil dentro de "Más"**; sin scrollbar visible.
- **Dashboard**: escritorio completo (KPIs primarios + secundarios + donut estado inventario + top productos + clientes por tipo + requieren atención); móvil resumido (hero Utilidad + 4 KPIs + alertas). Selector de periodo y de sucursal (sede o consolidado).
- Notificaciones vía campana en todas las vistas.

## Entregable de la Fundación

Esqueleto funcional end-to-end:
1. Registro de un tenant → subdominio activo.
2. Login (Supabase Auth) con resolución de tenant por subdominio.
3. Dashboard con el **shell dual-tier** operativo, modo claro/oscuro, roles aplicados y multi-sucursal (selector + consolidado).
4. RLS activo y verificado (un tenant no ve datos de otro).

Los módulos de negocio se construyen encima, cada uno en su propio ciclo spec → plan → implementación.

## Criterios de éxito

- Un nuevo tenant se registra y obtiene su subdominio funcionando.
- El login resuelve el tenant correcto y RLS impide el cruce de datos (verificado con test).
- El shell dual-tier, el toggle panel-left, el FAB squircle y el dashboard se ven idénticos a lo aprobado en `docs/design/`.
- Claro/oscuro funcionan en todo el shell.
- Los roles ven lo que corresponde; los operativos quedan limitados a su sucursal.
- Mobile-first: navegación por barra inferior + "Más" según lo aprobado.
