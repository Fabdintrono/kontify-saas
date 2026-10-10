-- 0028_getting_started_hidden.sql
-- El checklist «Primeros pasos» del inicio se calcula con datos reales; aquí solo se guarda si el
-- dueño/admin decidió ocultarlo (al llegar al 100 %).
alter table public.tenants
  add column if not exists getting_started_hidden boolean not null default false;
