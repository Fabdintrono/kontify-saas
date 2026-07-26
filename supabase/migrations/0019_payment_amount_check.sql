-- 0019_payment_amount_check.sql
-- Red final de correctitud del dinero: el monto de un cobro debe ser positivo.
-- (Zod ya lo valida en la app; esto lo garantiza a nivel BD e impide 0/negativos.)
alter table public.payments
  add constraint payments_amount_positive check (amount > 0);
