import { describe, expect, it } from "vitest";
import { countByKind, filterMoves, isMoveKind, moveQtyText, moveTitle, type MoveRow } from "./stock-moves";

const row = (over: Partial<MoveRow>): MoveRow => ({ id: "1", at: "2026-11-05T15:00:00Z", kind: "purchase", name: "Peito de frango", baseUnit: "g", finished: false, qty: 5000, note: null, paid: null, ...over });

describe("movimentos do estoque", () => {
  it("quantidade como a pessoa lê: compra soma, perda e uso tiram, contagem é o valor real", () => {
    expect(moveQtyText(row({ qty: 5000 }))).toBe("+5 kg");
    expect(moveQtyText(row({ kind: "waste", qty: -300 }))).toBe("−300 g");
    expect(moveQtyText(row({ kind: "count", qty: 8000 }))).toBe("contou 8 kg");
    expect(moveQtyText(row({ kind: "produced", finished: true, baseUnit: "un", qty: 92 }))).toBe("+92 un");
  });

  it("filtra por tipo e por parte do nome sem acento", () => {
    const rows = [row({ id: "a" }), row({ id: "b", kind: "waste", qty: -200, name: "Mandioca" }), row({ id: "c", kind: "count", name: "Feijão" })];
    expect(filterMoves(rows, { kind: "waste" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterMoves(rows, { query: "feijao" }).map((r) => r.id)).toEqual(["c"]);
    expect(filterMoves(rows, { kind: "count", query: "frango" })).toEqual([]);
    expect(filterMoves(rows, {})).toHaveLength(3);
  });

  it("conta por tipo e reconhece tipos válidos", () => {
    const c = countByKind([row({}), row({ id: "2" }), row({ id: "3", kind: "waste", qty: -1 })]);
    expect(c.purchase).toBe(2);
    expect(c.waste).toBe(1);
    expect(isMoveKind("waste")).toBe(true);
    expect(isMoveKind("xyz")).toBe(false);
    expect(moveTitle(row({}))).toBe("Compra · Peito de frango");
  });
});
