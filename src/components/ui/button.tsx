import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "danger";
const ICONS = { plus: Plus, pencil: Pencil, trash: Trash2 } as const;
export type ButtonIcon = keyof typeof ICONS;

const BASE = "inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold disabled:opacity-60";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[#0e7490] text-white hover:bg-[#0c6178]",
  secondary: "border border-[var(--border)] font-medium text-[var(--text)] hover:bg-[var(--bg)]",
  // En página, lo destructivo es secundario con texto rojo; el rojo sólido vive solo en el ConfirmDialog.
  danger: "border border-[#b91c1c]/40 font-medium text-[#b91c1c] hover:bg-[#b91c1c]/5 dark:text-[#f87171] dark:border-[#f87171]/40",
};

/** Clases del botón, para los casos en que hace falta un `<Link>` o un `<button>` de Radix con `asChild`. */
export function buttonCls(variant: ButtonVariant = "secondary", extra = ""): string {
  return `${BASE} ${VARIANT[variant]} ${extra}`.trim();
}

export function Button({ variant = "secondary", icon, className, children, ...rest }: {
  variant?: ButtonVariant; icon?: ButtonIcon; children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <button className={buttonCls(variant, className)} {...rest}>
      {Icon && <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />}{children}
    </button>
  );
}
