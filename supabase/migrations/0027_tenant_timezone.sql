-- 0027_tenant_timezone.sql
-- Zona horaria de la empresa (IANA). Todo rango "hoy / esta semana / este mes" y toda fecha
-- mostrada se calcula en esta zona, no en la del servidor ni en UTC.
alter table public.tenants
  add column if not exists timezone text not null default 'America/Caracas';

alter table public.tenants
  add constraint tenants_timezone_iana check (timezone ~ '^[A-Za-z_]+(/[A-Za-z_+-]+)+$' or timezone = 'UTC');
