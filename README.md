# Kontify

SaaS administrativo multi-tenant para pymes y emprendimientos de cualquier país (no fiscal): inventario, ventas, compras, finanzas, clientes, vendedores y cajeros. Funciona para farmacia, ferretería, ropa, almacén mayor/detal, restaurante, etc.

- **Dominio:** `kontify.app` · subdominios por cliente `cliente.kontify.app`
- **Stack:** Next.js (App Router) + TypeScript + Tailwind · Supabase Cloud (Postgres + Auth + RLS)
- **Despliegue:** Coolify en Hetzner · repo en GitHub

## Documentación

- **Sistema de diseño (UX/UI, fuente de verdad):** [`docs/design/design-system.md`](docs/design/design-system.md)
- **Spec de la Fundación:** [`docs/superpowers/specs/2026-07-19-kontify-fundacion-design.md`](docs/superpowers/specs/2026-07-19-kontify-fundacion-design.md)
- **Mockups aprobados:** [`docs/design/mockups/`](docs/design/mockups/) (abrir los `.html` en el navegador)

## Estado

Diseño de la Fundación aprobado (2026-07-19). Pendiente: plan de implementación.

El proyecto se construye por sub-proyectos independientes (spec → plan → implementación): Fundación → módulos operativos → super-admin → landing/SEO → módulos premium (Marketing, RRHH, Contabilidad).
