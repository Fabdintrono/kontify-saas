"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg(error.message); return; }
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm p-6 space-y-3">
      <h1 className="text-xl font-bold">Entrar a Kontify</h1>
      <input className="w-full border rounded p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="w-full border rounded p-2" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="w-full bg-brand text-white rounded p-2 font-semibold">Entrar</button>
      <p className="text-sm text-ink-soft">{msg}</p>
    </form>
  );
}
