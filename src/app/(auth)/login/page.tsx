"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    window.location.href = "/dashboard";
  }

  const input = "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[#0e7490]";
  return (
    <form onSubmit={submit} className="space-y-3">
      <h1 className="text-xl font-extrabold tracking-[-0.4px] text-[var(--text)]">Entrar a Kontify</h1>
      <p className="text-sm text-[var(--text-soft)]">Bienvenido de vuelta.</p>
      <input className={input} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={input} placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button disabled={loading} className="w-full rounded-[10px] bg-gradient-to-br from-[#0e7490] to-[#14b8a6] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {loading ? "Entrando…" : "Entrar"}
      </button>
      {msg && <p className="text-sm text-[#dc2626]">{msg}</p>}
      <p className="text-sm text-[var(--text-soft)]">¿No tienes cuenta? <Link href="/registro" className="font-semibold text-[#0e7490] dark:text-[#5eead4]">Crear una</Link></p>
    </form>
  );
}
