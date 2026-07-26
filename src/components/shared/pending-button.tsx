"use client";
import { useFormStatus } from "react-dom";

// Botón de submit para <form action={serverAction}> que se deshabilita mientras la acción corre.
// Evita el doble-submit en acciones sensibles (p. ej. convertir un presupuesto en venta).
export function PendingButton({ children, className, pendingLabel }: {
  children: React.ReactNode; className?: string; pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={className}>{pending ? (pendingLabel ?? "…") : children}</button>;
}
