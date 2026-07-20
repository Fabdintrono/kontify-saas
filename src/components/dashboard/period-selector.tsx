"use client";
import { useState } from "react";

const PERIODS = ["Hoy", "Semana", "Mes", "Año"] as const;

export function PeriodSelector() {
  const [active, setActive] = useState<(typeof PERIODS)[number]>("Mes");
  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
      {PERIODS.map((p) => (
        <button key={p} onClick={() => setActive(p)}
          className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
            active === p ? "bg-[#0e7490] text-white" : "text-[var(--text-soft)] hover:text-[var(--text)]"}`}>
          {p}
        </button>
      ))}
    </div>
  );
}
