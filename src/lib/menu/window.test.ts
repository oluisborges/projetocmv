import { describe, expect, it } from "vitest";
import { isStale, MAX_CHAIN_DEPTH, menuLookbackStart, shouldChain } from "./window";

describe("janela da carga inicial", () => {
  it("mês atual + 3 anteriores, a partir do dia 1 em Brasília", () => {
    // 17/10/2026 -> começa em 01/07/2026 00:00 BRT (03:00 UTC)
    expect(menuLookbackStart(new Date("2026-10-17T15:00:00Z")).toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });

  it("atravessa o ano", () => {
    expect(menuLookbackStart(new Date("2026-02-10T12:00:00Z")).toISOString()).toBe("2025-11-01T03:00:00.000Z");
  });

  it("usa o mês de Brasília, não o de UTC (noite do último dia)", () => {
    // 01/11 01:00 UTC ainda é 31/10 22:00 em Brasília: o mês atual é outubro
    expect(menuLookbackStart(new Date("2026-11-01T01:00:00Z")).toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });
});

describe("conexão atrasada", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("nunca sincronizou = atrasada", () => expect(isStale(null, now)).toBe(true));
  it("sincronizou há 20 h = em dia", () => expect(isStale("2026-10-16T16:00:00Z", now)).toBe(false));
  it("sincronizou há 2 dias = atrasada", () => expect(isStale("2026-10-15T12:00:00Z", now)).toBe(true));
});

describe("encadear ciclos", () => {
  const base = { phase: "history" as const, pending: 0, progressed: true, error: false, depth: 0 };
  it("continua enquanto lista o histórico", () => expect(shouldChain(base)).toBe(true));
  it("continua com fila pendente", () => expect(shouldChain({ ...base, phase: "done", pending: 12 })).toBe(true));
  it("para quando está em dia e a fila acabou", () => expect(shouldChain({ ...base, phase: "done" })).toBe(false));
  it("para em erro ou sem progresso", () => {
    expect(shouldChain({ ...base, error: true })).toBe(false);
    expect(shouldChain({ ...base, progressed: false })).toBe(false);
  });
  it("para ao atingir o limite da corrente", () => expect(shouldChain({ ...base, depth: MAX_CHAIN_DEPTH })).toBe(false));
});
