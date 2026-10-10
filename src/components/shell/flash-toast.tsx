"use client";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { flashMessage } from "@/lib/flash";

/** Lee ?flash=clave&arg=… tras un redirect, muestra el toast y limpia la URL (sin recargar). */
export function FlashToast() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const key = sp.get("flash");
  const arg = sp.get("arg");
  useEffect(() => {
    if (!key) return;
    const msg = flashMessage(key, arg);
    if (msg) toast(msg);
    const next = new URLSearchParams(sp.toString());
    next.delete("flash"); next.delete("arg");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, arg]);
  return null;
}
