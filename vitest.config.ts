import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Entorno por defecto: node (tests de integración contra Supabase). Los tests de
  // componente/tema declaran jsdom por-archivo con `// @vitest-environment jsdom`.
  test: { environment: "node", testTimeout: 20000, fileParallelism: false },
});
