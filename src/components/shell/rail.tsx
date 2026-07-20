"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavSection } from "@/lib/nav";
import { resolveActiveSection } from "@/lib/nav";
import { Tooltip } from "@/components/ui/tooltip";

export function Rail({ sections, config }: { sections: NavSection[]; config: NavSection | null }) {
  const pathname = usePathname();
  const activeId = resolveActiveSection(pathname)?.id;

  const Tile = ({ section }: { section: NavSection }) => {
    const active = section.id === activeId;
    const Icon = section.icon;
    return (
      <Tooltip label={section.label}>
        <Link href={section.children[0].href} aria-label={section.label}
          className={`grid h-11 w-11 place-items-center rounded-xl transition ${
            active ? "bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white shadow-[0_0_16px_rgba(20,184,166,0.5)]"
                   : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </Link>
      </Tooltip>
    );
  };

  return (
    <nav className="flex h-full w-[72px] flex-col items-center gap-2 bg-[#0f172a] py-4">
      <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-sm font-black text-white">K</div>
      {sections.map((s) => <Tile key={s.id} section={s} />)}
      <div className="mt-auto flex flex-col items-center gap-2">
        {config && <Tile section={config} />}
      </div>
    </nav>
  );
}
