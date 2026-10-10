"use client";
import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { toggleDir, type SortDir } from "@/lib/sorting";
import type { Align } from "./data-table";

const JUSTIFY: Record<Align, string> = { left: "justify-start", right: "justify-end", center: "justify-center" };

/** Cabecera de columna que ordena. Escribe `sort` y `dir` en la URL y borra `page`:
 *  seguir en la página 7 de otro orden no significa nada.
 *  El icono es decorativo; quien anuncia el estado es el `aria-sort` del `<th>` que la envuelve. */
export function SortHeader({ columnKey, label, align = "left", natural, active, dir }: {
  columnKey: string; label: string; align?: Align; natural: SortDir;
  active: boolean; dir: SortDir | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function go() {
    const next = toggleDir(active && dir ? { key: columnKey, dir } : null, columnKey, natural);
    const params = new URLSearchParams(sp.toString());
    params.set("sort", columnKey);
    params.set("dir", next);
    params.delete("page");
    start(() => router.push(`${pathname}?${params.toString()}`));
  }

  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <button type="button" onClick={go} aria-busy={pending}
      className={`inline-flex w-full items-center gap-1 rounded transition-colors hover:text-[var(--text)] ${JUSTIFY[align]} ${
        active ? "font-semibold text-[var(--text)]" : ""}`}>
      {label}
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "" : "opacity-40"}`} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}
