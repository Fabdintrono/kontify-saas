"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FIELD } from "@/components/ui/field";

export default function Registro() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "", companyName: "", slug: "" });
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("Creando…");
    const r = await fetch("/api/registro", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await r.json();
    setLoading(false);
    setMsg(r.ok ? `Listo. Tu espacio: ${data.slug}.kontify.app` : `Error: ${data.error}`);
    if (r.ok) window.location.href = "/dashboard";
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const input = FIELD;

  return (
    <form onSubmit={submit} className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Crear cuenta Kontify</h1>
      <p className="text-sm text-[var(--text-soft)]">Crea tu empresa en un minuto.</p>
      <input className={input} placeholder="Empresa" value={form.companyName} onChange={set("companyName")} />
      <input className={input} placeholder="subdominio (ej. acme)" value={form.slug} onChange={set("slug")} />
      <input className={input} placeholder="Tu nombre" value={form.fullName} onChange={set("fullName")} />
      <input className={input} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
      <input className={input} placeholder="Contraseña" type="password" value={form.password} onChange={set("password")} />
      <Button variant="primary" className="w-full" disabled={loading}>
        {loading ? "Creando…" : "Crear"}
      </Button>
      {msg && <p className="text-sm text-[var(--text-soft)]">{msg}</p>}
      <p className="text-sm text-[var(--text-soft)]">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-[#0e7490] dark:text-[#5eead4]">Entrar</Link></p>
    </form>
  );
}
