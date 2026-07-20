import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Tests de integración contra Supabase local: sin paralelismo entre archivos
  // para no golpear GoTrue concurrentemente (createUser flakea bajo carga).
  test: { environment: "node", testTimeout: 20000, fileParallelism: false },
});
