export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export type SaleLineInput = { quantity: number; unitPrice: number; discountPct: number; taxRate: number };
export type SaleTotals = {
  subtotal: number; discountTotal: number; taxTotal: number; total: number;
  lines: { neto: number; tax: number; total: number }[];
};

export function computeSaleTotals(items: SaleLineInput[], globalDiscountPct = 0): SaleTotals {
  const g = globalDiscountPct || 0;
  const factorGlobal = 1 - g / 100;
  let subtotalBruto = 0, lineDiscTotal = 0, taxTotal = 0;

  const netos = items.map((it) => {
    const base = (it.quantity || 0) * (it.unitPrice || 0);
    const descLinea = base * ((it.discountPct || 0) / 100);
    const neto = base - descLinea;
    subtotalBruto += neto;
    lineDiscTotal += descLinea;
    return { neto, taxRate: it.taxRate || 0 };
  });

  const descGlobal = subtotalBruto * (g / 100);
  const lines = netos.map((n) => {
    const netoFinal = n.neto * factorGlobal;
    const tax = netoFinal * (n.taxRate / 100);
    taxTotal += tax;
    return { neto: round2(n.neto), tax: round2(tax), total: round2(netoFinal + tax) };
  });

  return {
    subtotal: round2(subtotalBruto),
    discountTotal: round2(lineDiscTotal + descGlobal),
    taxTotal: round2(taxTotal),
    total: round2(subtotalBruto - descGlobal + taxTotal),
    lines,
  };
}
