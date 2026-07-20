"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { resolveActiveSection } from "@/lib/nav";

export function SubNav({ sections, config, collapsed }: {
  sections: NavSection[]; config: NavSection | null; collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = resolveActiveSection(pathname) ?? sections[0] ?? config;
  if (!active) return null;

  return (
    <aside
      className="h-full overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-[280ms]"
      style={{ width: collapsed ? 0 : 236 }}>
      <div className="w-[236px] p-3">
        <p className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-wide text-[var(--text-soft)]">{active.label}</p>
        <ul className="space-y-1">
          {active.children.map((child) => {
            const on = pathname === child.href || pathname.startsWith(child.href + "/");
            const Icon = child.icon;
            return (
              <li key={child.href}>
                <Link href={child.href}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    on ? "bg-[#e6f7f4] font-semibold text-[#0e7490] dark:bg-[#0e7490]/15 dark:text-[#5eead4]"
                       : "text-[var(--text)] hover:bg-[var(--bg)]"}`}>
                  {on && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[#0e7490] dark:bg-[#5eead4]" />}
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
