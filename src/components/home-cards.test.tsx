import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { monthHealth } from "@/lib/month-health";
import { MonthHealthCard, PriceActionsCard } from "./home-cards";

// A ação do servidor puxa módulos "server-only"; aqui só a marcação importa.
vi.mock("@/app/(app)/cardapio/precos-actions", () => ({ setRecipePrice: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const health = (breakEvenRevenue: number | null) =>
  monthHealth({ monthStart: "2026-09-01", now: new Date(Date.UTC(2026, 8, 10, 15)), revenue: 15000, insumosCost: 5250, variablePct: 0.06, fixedTotal: 12000, breakEvenRevenue });

describe("cartões do início", () => {
  it("mostra a sobra, a projeção e o equilíbrio", () => {
    const html = renderToStaticMarkup(<MonthHealthCard health={health(36000)} month="2026-09-01" canWrite />);
    expect(html).toContain("Sobra até agora");
    expect(html).toContain("No ritmo de hoje");
    expect(html).toMatch(/Faltam .* para pagar todas as contas/);
    expect(html).toContain("/producao/fechar-mes?mes=2026-09");
  });

  it("sem permissão de edição não oferece o link para atualizar", () => {
    const html = renderToStaticMarkup(<MonthHealthCard health={health(null)} month="2026-09-01" canWrite={false} />);
    expect(html).not.toContain("/producao/fechar-mes?mes=");
    expect(html).not.toContain("Ponto de equilíbrio");
  });

  it("lista a ação de preço com o valor novo", () => {
    const html = renderToStaticMarkup(
      <PriceActionsCard targetPct={0.1} actions={[{ id: "a", name: "Frango com arroz", price: 17, targetPrice: 19, rise: 2, risePct: 2 / 17, currentNetPct: 0.04, gainPerMonth: 188 }]} />,
    );
    expect(html).toContain("Frango com arroz");
    expect(html).toMatch(/17,00[\s\S]*19,00/);
    expect(html).toContain("/cardapio/a/preco");
  });

  it("quem pode editar ganha o botão de aplicar o preço; quem só lê, não", () => {
    const actions = [{ id: "a", name: "Frango", price: 17, targetPrice: 19, rise: 2, risePct: 2 / 17, currentNetPct: 0.04, gainPerMonth: null }];
    expect(renderToStaticMarkup(<PriceActionsCard targetPct={0.1} actions={actions} canWrite />)).toContain("Aplicar");
    expect(renderToStaticMarkup(<PriceActionsCard targetPct={0.1} actions={actions} />)).not.toContain("Aplicar");
  });

  it("sem ações não mostra nada", () => {
    expect(renderToStaticMarkup(<PriceActionsCard targetPct={0.1} actions={[]} />)).toBe("");
  });
});
