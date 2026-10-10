import { formatMoney } from "@/lib/format";

export type DocumentLine = { id: string; description: string; quantity: number; unit_price: number; discount_pct: number; tax_rate: number };

/** Las líneas de una venta o un presupuesto: tabla en escritorio, tarjeta por línea en el teléfono. */
export function DocumentLines({ items, netos, currency }: { items: DocumentLine[]; netos: number[]; currency: string }) {
  const c = currency;
  return (
    <>
      <table className="hidden w-full text-sm print:table lg:table">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-soft)]">
            <th className="py-1 font-medium">Descripción</th><th className="font-medium">Cant.</th>
            <th className="font-medium">Precio</th><th className="font-medium">Desc%</th><th className="font-medium">IVA%</th>
            <th className="text-right font-medium">Neto</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-b border-[var(--border)]">
              <td className="py-1.5 text-[var(--text)]">{it.description}</td>
              <td className="text-[var(--text-soft)]">{Number(it.quantity)}</td>
              <td className="text-[var(--text-soft)]">{formatMoney(Number(it.unit_price), c)}</td>
              <td className="text-[var(--text-soft)]">{Number(it.discount_pct)}%</td>
              <td className="text-[var(--text-soft)]">{Number(it.tax_rate)}%</td>
              <td className="text-right text-[var(--text)]">{formatMoney(netos[i] ?? 0, c)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul data-lineas-movil className="space-y-2 print:hidden lg:hidden">
        {items.map((it, i) => (
          <li key={it.id} className="rounded-xl border border-[var(--border)] p-3">
            <p className="font-medium text-[var(--text)]">{it.description}</p>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[var(--text-soft)]">
              <div className="flex justify-between"><dt>Cant.</dt><dd className="text-[var(--text)]">{Number(it.quantity)}</dd></div>
              <div className="flex justify-between"><dt>Precio</dt><dd className="text-[var(--text)]">{formatMoney(Number(it.unit_price), c)}</dd></div>
              <div className="flex justify-between"><dt>Desc.</dt><dd className="text-[var(--text)]">{Number(it.discount_pct)}%</dd></div>
              <div className="flex justify-between"><dt>IVA</dt><dd className="text-[var(--text)]">{Number(it.tax_rate)}%</dd></div>
              <div className="col-span-2 flex justify-between border-t border-[var(--border)] pt-1 text-sm font-semibold text-[var(--text)]">
                <dt>Neto</dt><dd>{formatMoney(netos[i] ?? 0, c)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
