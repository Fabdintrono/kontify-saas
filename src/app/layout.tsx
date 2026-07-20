import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kontify",
  description: "Gestión administrativa para tu negocio",
};

// Aplica el tema ANTES de pintar para evitar el parpadeo claro→oscuro (FOUC).
const themeScript = `(function(){try{var t=localStorage.getItem('kontify-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
