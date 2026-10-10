-- 0027_tenant_timezone.sql
-- Zona horaria de la empresa (IANA). Todo rango "hoy / esta semana / este mes" y toda fecha
-- mostrada se calcula en esta zona, no en la del servidor ni en UTC.
-- El default debe coincidir con DEFAULT_TZ en src/lib/tz.ts.
alter table public.tenants
  add column if not exists timezone text not null default 'America/Caracas';

-- Solo valida la FORMA (la validación real contra la base IANA la hace la app con Intl).
alter table public.tenants drop constraint if exists tenants_timezone_iana;
alter table public.tenants
  add constraint tenants_timezone_iana check (timezone ~ '^[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)*$');
