import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger";
const ICONS = { plus: Plus, pencil: Pencil, trash: Trash2 } as const;
export type ButtonIcon = keyof typeof ICONS;

/** Geometría común de todo botón: la comparte el rojo sólido del ConfirmDialog, que trae su propio color. */
/** `active:scale-[0.98]`: el botón responde al dedo antes de que llegue la respuesta
 *  del servidor. Es el acuse de recibo más barato que existe. */
export const BUTTON_BASE =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold " +
  "transition-[background-color,border-color,color,transform] duration-150 " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[#0e7490] text-white hover:bg-[#0c6178]",
  secondary: "border border-[var(--border)] font-medium text-[var(--text)] hover:bg-[var(--bg)]",
  // En página, lo destructivo es secundario con texto rojo; el rojo sólido vive solo en el ConfirmDialog.
  danger: "border border-[#b91c1c]/40 font-medium text-[#b91c1c] hover:bg-[#b91c1c]/5 dark:text-[#f87171] dark:border-[#f87171]/40",
};

/** Clases del botón, para los casos en que hace falta un `<Link>` o un `<button>` de Radix con `asChild`. */
export function buttonCls(variant: ButtonVariant = "secondary", extra = ""): string {
  return `${BUTTON_BASE} ${VARIANT[variant]} ${extra}`.trim();
}

/** Rueda de carga de cualquier botón. Decorativa: lo que anuncia la espera es `aria-busy`. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} strokeWidth={2.5} aria-hidden="true" />;
}

export function Button({ variant = "secondary", icon, loading, className, children, disabled, ...rest }: {
  variant?: ButtonVariant; icon?: ButtonIcon; loading?: boolean; children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <button className={buttonCls(variant, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading
        ? <Spinner />
        : Icon && <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </button>
  );
}
