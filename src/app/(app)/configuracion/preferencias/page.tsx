import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ModuleHeader } from "@/components/shared/module-header";
import { Page } from "@/components/shared/page";

export default function Preferencias() {
  return (
    <Page>
      <ModuleHeader module="config_preferencias" />
      <div className="mt-4 max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Tema</p>
            <p className="text-xs text-[var(--text-soft)]">Claro u oscuro. Se recuerda en este dispositivo.</p>
          </div>
          <ThemeToggle withLabel />
        </div>
        <p className="mt-4 text-xs text-[var(--text-soft)]">Más preferencias llegan pronto.</p>
      </div>
    </Page>
  );
}
