"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { resolveTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => { setThemeState(resolveTheme()); }, []);

  function onClick() { setThemeState(toggleTheme()); }
  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Modo claro" : "Modo oscuro";

  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg)]">
      <Icon className="h-4 w-4" strokeWidth={2} />
      {withLabel && <span>{label}</span>}
    </button>
  );
}
