"use client";
import { useState } from "react";

export default function Registro() {
  const [form, setForm] = useState({ email: "", password: "", fullName: "", companyName: "", slug: "" });
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Creando…");
    const r = await fetch("/api/registro", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await r.json();
    setMsg(r.ok ? `Listo. Tu espacio: ${data.slug}.kontify.app` : `Error: ${data.error}`);
    if (r.ok) window.location.href = "/dashboard";
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-xl font-bold">Crear cuenta Kontify</h1>
      <input className="w-full border rounded p-2" placeholder="Empresa" value={form.companyName} onChange={set("companyName")} />
      <input className="w-full border rounded p-2" placeholder="subdominio (ej. acme)" value={form.slug} onChange={set("slug")} />
      <input className="w-full border rounded p-2" placeholder="Tu nombre" value={form.fullName} onChange={set("fullName")} />
      <input className="w-full border rounded p-2" placeholder="Email" type="email" value={form.email} onChange={set("email")} />
      <input className="w-full border rounded p-2" placeholder="Contraseña" type="password" value={form.password} onChange={set("password")} />
      <button className="w-full bg-brand text-white rounded p-2 font-semibold">Crear</button>
      <p className="text-sm text-ink-soft">{msg}</p>
    </form>
  );
}
