// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { dispatchOrigin } from "./dispatch";

describe("dispatchOrigin", () => {
  it("em produção usa o domínio de produção, não o endereço do deploy protegido", () => {
    expect(dispatchOrigin("https://projetocmv-abc-x.vercel.app", { VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "projetocmv-livid.vercel.app" })).toBe("https://projetocmv-livid.vercel.app");
  });
  it("fora de produção (ou sem a variável) mantém a origem recebida", () => {
    expect(dispatchOrigin("http://localhost:3000", {})).toBe("http://localhost:3000");
    expect(dispatchOrigin("https://x.vercel.app", { VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "p.vercel.app" })).toBe("https://x.vercel.app");
  });
});
