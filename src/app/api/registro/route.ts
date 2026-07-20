import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { email, password, fullName, companyName, slug } = await req.json();
  if (!email || !password || !companyName || !slug) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }
  const supabase = await createClient();

  const { error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) return NextResponse.json({ error: signUpErr.message }, { status: 400 });

  // La sesión ya está activa (email confirm off en local). Crear el tenant.
  const { data: tenantId, error: rpcErr } = await supabase.rpc("bootstrap_tenant", {
    p_name: companyName, p_slug: slug, p_full_name: fullName ?? "",
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  return NextResponse.json({ tenantId, slug });
}
