import { describe, expect, it } from "vitest";
import { addDays, defaultPlanWeek, isMonday, lastFullWeeks, weekBounds, weekLabel, weekStartOf } from "./week";

describe("semanas de produção (segunda a domingo, Brasília)", () => {
  it("a segunda-feira da semana de qualquer dia", () => {
    expect(weekStartOf(new Date("2026-10-28T15:00:00Z"))).toBe("2026-10-26"); // quarta
    expect(weekStartOf(new Date("2026-11-01T20:00:00Z"))).toBe("2026-10-26"); // domingo à tarde
    expect(weekStartOf(new Date("2026-10-26T03:00:00Z"))).toBe("2026-10-26"); // segunda 00:00 em Brasília
  });

  it("à meia-noite de Brasília a semana vira (e não às 00:00 UTC)", () => {
    expect(weekStartOf(new Date("2026-10-26T02:59:00Z"))).toBe("2026-10-19"); // domingo 23:59 em Brasília
    expect(weekStartOf(new Date("2026-10-26T03:00:00Z"))).toBe("2026-10-26");
  });

  it("semana a planejar: a próxima; na segunda, a própria", () => {
    expect(defaultPlanWeek(new Date("2026-10-28T15:00:00Z"))).toBe("2026-11-02");
    expect(defaultPlanWeek(new Date("2026-10-26T12:00:00Z"))).toBe("2026-10-26");
    expect(defaultPlanWeek(new Date("2026-11-01T20:00:00Z"))).toBe("2026-11-02");
  });

  it("limites da semana em UTC e rótulo", () => {
    const { start, end } = weekBounds("2026-10-26");
    expect(start.toISOString()).toBe("2026-10-26T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(weekLabel("2026-10-26")).toBe("26/10 a 01/11");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("últimas semanas completas, da mais antiga para a mais recente", () => {
    expect(lastFullWeeks(new Date("2026-10-28T15:00:00Z"), 4)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
  });

  it("só segunda-feira vale como início de semana", () => {
    expect(isMonday("2026-10-26")).toBe(true);
    expect(isMonday("2026-10-27")).toBe(false);
    expect(isMonday("lixo")).toBe(false);
  });
});
