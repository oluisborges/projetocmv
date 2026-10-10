import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // O Postgres embutido aplica todas as migrations antes dos testes de banco: em máquina ocupada passa de 10 s.
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}", "supabase/tests/**/*.test.ts"], hookTimeout: 60_000, testTimeout: 30_000 },
});
