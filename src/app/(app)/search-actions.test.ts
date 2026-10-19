// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; filters: [string, unknown][]; ilike?: string };
const calls = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/auth", () => ({ requireMember: async () => ({ orgId: "org-1", canWrite: true }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.eq = (c: string, v: unknown) => (call.filters.push([c, v]), chain);
      chain.is = (c: string, v: unknown) => (call.filters.push([c, v]), chain);
      chain.ilike = (_c: string, v: string) => ((call.ilike = v), chain);
      chain.order = self;
      chain.limit = () => Promise.resolve({ data: [{ id: `${table}-1`, name: "Frango" }], count: 1, error: null });
      return chain;
    },
  }),
}));

import { searchAll } from "./search-actions";

const all = () => calls as Call[];

describe("busca global", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("menos de 2 letras não consulta nada", async () => {
    expect(await searchAll("a")).toEqual({ results: [], total: 0 });
    expect(await searchAll("  ")).toEqual({ results: [], total: 0 });
    expect(calls).toHaveLength(0);
  });

  it("toda consulta filtra pela marmitaria do servidor (insumos, marmitas e combos)", async () => {
    await searchAll("frango");
    expect(all().map((c) => c.table).sort()).toEqual(["combos", "ingredients", "recipes"]);
    for (const c of all()) expect(c.filters).toContainEqual(["org_id", "org-1"]);
  });

  it("tira os caracteres que têm sentido no filtro (%, _, \, vírgula, parênteses, *)", async () => {
    await searchAll("50%_\,(x)*");
    const term = all()[0].ilike!;
    expect(term).not.toMatch(/[_\,()*]/);
    expect(term.slice(1, -1)).not.toContain("%");
  });

  it("limita o tamanho do termo", async () => {
    await searchAll("a".repeat(500));
    expect(all()[0].ilike!.length).toBeLessThanOrEqual(62); // % + 60 letras + %
  });

  it("junta os três tipos e o total", async () => {
    const r = await searchAll("frango");
    expect(r.results.map((x) => x.type).sort()).toEqual(["combo", "insumo", "marmita"]);
    expect(r.total).toBe(3);
  });
});
