import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next 16: el convenio `middleware` se renombró a `proxy` (misma ejecución server-side
// antes de renderizar rutas). Ver node_modules/next/dist/docs/.../proxy.md
export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req });

  // Refrescar sesión (cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );
  await supabase.auth.getUser();

  // Resolver subdominio → x-tenant-slug
  const host = req.headers.get("host") ?? "";
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").split(":")[0];
  const hostname = host.split(":")[0];
  let slug = "";
  if (root && hostname.endsWith(root) && hostname !== root) {
    slug = hostname.slice(0, hostname.length - root.length - 1); // "acme" de "acme.lvh.me"
  }
  res.headers.set("x-tenant-slug", slug);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
