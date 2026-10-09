import { describe, expect, it } from "vitest";
import { daysSince, formatAge, formatPct, formatPurchaseSize, parseDecimal } from "./format";

describe("parseDecimal (o que o dono digita)", () => {
  it.each([
    ["14,5", "14.5"],
    ["14,50", "14.50"],
    ["R$ 1.234,56", "1234.56"],
    ["1.234", "1234"],
    ["12.345.678", "12345678"],
    ["14.5", "14.5"],
    ["0,014", "0.014"],
    ["  90  ", "90"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(["", "abc", "1,2,3", "1.2.3", "14,5x", "--1", "R$"])("recusa %j", (input) => {
    expect(parseDecimal(input)).toBeNull();
  });

  it("negativo só quando permitido (reajuste de -5%)", () => {
    expect(parseDecimal("-5")).toBeNull();
    expect(parseDecimal("-5", { allowNegative: true })).toBe("-5");
    expect(parseDecimal("-2,5", { allowNegative: true })).toBe("-2.5");
  });
});

describe("formatação", () => {
  it("percentual a partir de fração", () => {
    expect(formatPct(0.085)).toBe("8,5%");
    expect(formatPct(0.3)).toBe("30%");
  });

  it("tamanho da compra", () => {
    expect(formatPurchaseSize(1, "kg")).toBe("1 kg");
    expect(formatPurchaseSize(0.9, "l")).toBe("0,9 litro");
    expect(formatPurchaseSize(100, "un")).toBe("100 un");
  });

  it("idade do preço", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    expect(daysSince("2026-10-10T08:00:00Z", now)).toBe(0);
    expect(daysSince("2026-09-10T12:00:00Z", now)).toBe(30);
    expect(formatAge(0)).toBe("hoje");
    expect(formatAge(1)).toBe("ontem");
    expect(formatAge(12)).toBe("há 12 dias");
    expect(formatAge(45)).toBe("há 1 mês");
    expect(formatAge(95)).toBe("há 3 meses");
  });
});

describe("parseDecimal: ponto no teclado do celular", () => {
  it("'0.500' é meio, nunca 500 (zero à esquerda não é milhar)", () => {
    expect(parseDecimal("0.500")).toBe("0.500");
    expect(parseDecimal("0.250")).toBe("0.250");
    expect(parseDecimal("0.5")).toBe("0.5");
  });

  it("'1.250' continua sendo milhar (1250), como se escreve no Brasil", () => {
    expect(parseDecimal("1.250")).toBe("1250");
  });
});
