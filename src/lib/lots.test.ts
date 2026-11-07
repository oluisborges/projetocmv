import { describe, expect, it } from "vitest";
import { addDays, allocateLots, daysBetween, expiringSoon, lotCode, type Lot } from "./lots";

const lot = (id: string, producedOn: string, qty: number, expiresOn: string | null): Lot => ({ id, recipeId: "r1", code: lotCode(producedOn), qty, producedOn, expiresOn });

describe("lotes de marmitas prontas", () => {
  const lots = [lot("a", "2026-10-01", 100, "2026-12-30"), lot("b", "2026-10-20", 80, "2027-01-18"), lot("c", "2026-11-05", 60, "2027-02-03")];

  it("o saldo fica nos lotes mais novos (sai o mais antigo primeiro)", () => {
    // 100 + 80 + 60 = 240 produzidas; sobram 90 no congelador: 60 do lote c e 30 do b; o a já foi todo.
    const r = allocateLots(lots, 90);
    expect(r.map((l) => [l.id, l.remaining])).toEqual([["a", 0], ["b", 30], ["c", 60]]);
  });

  it("saldo maior que o produzido não inventa marmitas e saldo zero zera tudo", () => {
    expect(allocateLots(lots, 999).map((l) => l.remaining)).toEqual([100, 80, 60]);
    expect(allocateLots(lots, 0).every((l) => l.remaining === 0)).toBe(true);
    expect(allocateLots(lots, -5).every((l) => l.remaining === 0)).toBe(true);
    expect(allocateLots([], 10)).toEqual([]);
  });

  it("avisa o que vence em até 15 dias (ou já venceu), só dos lotes que ainda têm marmitas", () => {
    const r = allocateLots(lots, 240);
    const soon = expiringSoon(r, "2026-12-20", 15);
    expect(soon.map((x) => [x.lot.id, x.daysLeft])).toEqual([["a", 10]]);
    expect(expiringSoon(allocateLots(lots, 90), "2026-12-20", 15)).toEqual([]); // o lote a já foi consumido
    expect(expiringSoon(r, "2027-01-05", 15).map((x) => x.lot.id)).toEqual(["a", "b"]); // a venceu há 6 dias
    expect(expiringSoon(r, "2027-01-05", 15)[0].daysLeft).toBe(-6);
  });

  it("datas: soma de dias, diferença e código do lote", () => {
    expect(addDays("2026-11-07", 90)).toBe("2027-02-05");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-11-07", "2026-11-22")).toBe(15);
    expect(lotCode("2026-11-07")).toBe("L0711");
  });
});
