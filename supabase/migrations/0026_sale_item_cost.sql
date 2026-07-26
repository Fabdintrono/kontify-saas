-- 0026_sale_item_cost.sql
-- Snapshot del costo unitario al vender (para utilidad/margen). Nullable: se puebla
-- server-side desde products.cost; líneas de texto libre o ventas viejas quedan en null.
alter table public.sale_items add column unit_cost numeric(14,2);
