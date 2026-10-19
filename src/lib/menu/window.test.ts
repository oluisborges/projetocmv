import { describe, expect, it } from "vitest";
import { isStale, listPages, MAX_CHAIN_DEPTH, menuLookbackStart, needsKick, shouldChain } from "./window";

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

describe("importação parada", () => {
  const now = new Date("2026-10-17T15:00:00Z");
  const base = { status: "connected", phase: "done" as const, pending_orders: 284, locked_until: null, last_sync_at: "2026-10-17T14:46:40Z" };
  it("fila com pedidos e ciclo antigo = retoma", () => expect(needsKick(base, now)).toBe(true));
  it("carga do histórico em andamento = retoma", () => expect(needsKick({ ...base, phase: "history", pending_orders: 0 }, now)).toBe(true));
  it("em dia e sem fila = nada a fazer", () => expect(needsKick({ ...base, pending_orders: 0 }, now)).toBe(false));
  it("alguém está rodando agora = espera", () => expect(needsKick({ ...base, locked_until: "2026-10-17T15:00:30Z" }, now)).toBe(false));
  it("ciclo muito recente = espera", () => expect(needsKick({ ...base, last_sync_at: "2026-10-17T14:59:30Z" }, now)).toBe(false));
  it("conexão com erro de chave não é retomada", () => expect(needsKick({ ...base, status: "error" }, now)).toBe(false));
  it("trava vencida não impede", () => expect(needsKick({ ...base, locked_until: "2026-10-17T14:50:00Z" }, now)).toBe(true));
});

describe("listPages (listar pedidos sem estourar o tempo)", () => {
  it("lista tudo quando cabe", async () => {
    const seen: number[] = [];
    const r = await listPages({ startPage: 1, pageCostMs: 10, deadline: 1000, now: () => 0, fetchPage: async (p) => (seen.push(p), 3) });
    expect(seen).toEqual([1, 2, 3]);
    expect(r).toEqual({ complete: true, nextPage: 1 });
  });

  it("para antes de uma página que não cabe e devolve onde continuar", async () => {
    let clock = 0;
    const seen: number[] = [];
    const saved: number[] = [];
    const r = await listPages({
      startPage: 1, pageCostMs: 12_500, deadline: 30_000, now: () => clock,
      fetchPage: async (p) => { seen.push(p); clock += 12_500; return 10; },
      onPage: async (n) => { saved.push(n); },
    });
    expect(seen).toEqual([1, 2]);
    expect(r).toEqual({ complete: false, nextPage: 3 });
    expect(saved).toEqual([2, 3]);
  });

  it("retoma da página guardada", async () => {
    const seen: number[] = [];
    const r = await listPages({ startPage: 4, pageCostMs: 1, deadline: 1000, now: () => 0, fetchPage: async (p) => (seen.push(p), 5) });
    expect(seen).toEqual([4, 5]);
    expect(r.complete).toBe(true);
  });
});
