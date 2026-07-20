"use client";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function FabVender() {
  const router = useRouter();
  // Acción placeholder: la venta rápida real llega con el módulo de Facturación.
  return (
    <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion")}
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 place-items-center bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white shadow-xl transition hover:scale-105 lg:grid"
      style={{ borderRadius: "40%" }}>
      <Plus className="h-7 w-7" strokeWidth={2.5} />
    </button>
  );
}
