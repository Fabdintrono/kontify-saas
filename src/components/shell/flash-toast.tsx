"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { flashMessage } from "@/lib/flash";

/** Lee ?flash=clave&arg=… tras un redirect, muestra el toast y limpia la URL sin navegar
 *  (history.replaceState se integra con el router de Next y evita un segundo render del servidor). */
export function FlashToast() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const key = sp.get("flash");
  const arg = sp.get("arg");
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!key) return;
    const token = `${key}|${arg ?? ""}`;
    if (shown.current === token) return; // StrictMode re-ejecuta el efecto con las mismas props
    shown.current = token;
    const msg = flashMessage(key, arg);
    if (msg) toast(msg);
    const next = new URLSearchParams(sp.toString());
    next.delete("flash"); next.delete("arg");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [key, arg, sp, pathname, toast]);
  return null;
}
