import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("tira acento, símbolos e espaços", () => {
    expect(slugify("Marmitaria da Ana & Filhos")).toBe("marmitaria-da-ana-filhos");
    expect(slugify("  Cozinha São João!! ")).toBe("cozinha-sao-joao");
  });

  it("nome sem letras vira um padrão válido (mínimo 2 caracteres)", () => {
    expect(slugify("🍱")).toBe("marmitaria");
    expect(slugify("a")).toBe("marmitaria");
  });

  it("respeita o limite de tamanho do banco", () => {
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(50);
  });
});
