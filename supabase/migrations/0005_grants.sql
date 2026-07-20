-- 0005_grants.sql
-- RLS actúa por ENCIMA de los privilegios de tabla: sin GRANT, el rol
-- `authenticated` recibe 42501 aunque la política lo permita. Los rangos de
-- privilegios coinciden con las políticas de 0003 (RLS filtra las filas).
grant select, update                 on public.tenants     to authenticated;
grant select, insert, update, delete on public.branches    to authenticated;
grant select, update                 on public.profiles    to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
