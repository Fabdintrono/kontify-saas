export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-[#0e7490] to-[#14b8a6] p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 text-sm font-black">K</div>
          <span className="text-lg font-extrabold tracking-[-0.4px]">Kontify</span>
        </div>
        <div>
          <h2 className="max-w-sm text-2xl font-extrabold tracking-[-0.4px]">Gestión administrativa, clara y a tu ritmo.</h2>
          <p className="mt-2 max-w-sm text-sm text-white/80">Inventario, ventas, finanzas y clientes en un solo lugar.</p>
        </div>
        <p className="text-xs text-white/60">© Kontify</p>
      </div>
      <div className="flex items-center justify-center bg-[var(--bg)] p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
