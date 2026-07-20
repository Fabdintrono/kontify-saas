"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ShoppingCart, Plus, Boxes, Menu } from "lucide-react";
import { MobileMoreSheet } from "@/components/shell/mobile-more-sheet";
import type { ShellUser } from "@/components/shell/types";

export function MobileBottomNav({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const Item = ({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) => {
    const on = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${on ? "text-[#0e7490] dark:text-[#5eead4]" : "text-[var(--text-soft)]"}`}>
        <Icon className="h-5 w-5" strokeWidth={2} /> {label}
      </Link>
    );
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-[var(--border)] bg-[var(--surface)] px-2 lg:hidden">
        <Item href="/dashboard" icon={Home} label="Inicio" />
        <Item href="/reportes/ventas" icon={ShoppingCart} label="Vender" />
        <button aria-label="Vender" onClick={() => router.push("/operaciones/facturacion")}
          className="-mt-5 grid h-[46px] w-[46px] flex-none place-items-center bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white shadow-lg"
          style={{ borderRadius: 22 }}>
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <Item href="/reportes/inventario" icon={Boxes} label="Inventario" />
        <button onClick={() => setMoreOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-[var(--text-soft)]">
          <Menu className="h-5 w-5" strokeWidth={2} /> Más
        </button>
      </nav>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} user={user} />
    </>
  );
}
