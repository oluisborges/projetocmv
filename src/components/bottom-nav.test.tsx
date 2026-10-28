import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const path = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));

import { BottomNav } from "./bottom-nav";
import { CostsTabs } from "./costs-tabs";
import { PainelTabs } from "./painel-tabs";

const open = { painel: null, producao: null };
const newAccount = {
  painel: { message: "O Painel é liberado depois que você cria a sua primeira marmita.", href: "/marmitas/nova", cta: "Criar marmita" },
  producao: { message: "A Produção é liberada depois que você cria a sua primeira marmita.", href: "/marmitas/nova", cta: "Criar marmita" },
};

describe("menu de baixo", () => {
  it("sempre mostra os 6 itens, inclusive com tudo travado", () => {
    path.value = "/";
    for (const locks of [open, newAccount]) {
      const html = renderToStaticMarkup(<BottomNav locks={locks} />);
      for (const label of ["Início", "Marmitas", "Insumos", "Custos", "Painel", "Produção"]) expect(html).toContain(`>${label}<`);
    }
  });

  it("item travado vira botão com cadeado (não leva para a tela) e o liberado continua link", () => {
    path.value = "/";
    const html = renderToStaticMarkup(<BottomNav locks={newAccount} />);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Painel/);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Produção/);
    expect(html).not.toContain('href="/painel"');
    expect(html).not.toContain('href="/producao"');
    expect(html).toContain('href="/custos"');
    expect(html).toContain('href="/marmitas"');
  });

  it("tudo liberado: todos os itens são links", () => {
    path.value = "/";
    const html = renderToStaticMarkup(<BottomNav locks={open} />);
    for (const href of ["/", "/marmitas", "/insumos", "/custos", "/painel", "/producao"]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("aria-disabled");
  });

  it("quem já está na tela do item nunca vê esse item travado", () => {
    path.value = "/painel/cupons";
    const html = renderToStaticMarkup(<BottomNav locks={newAccount} />);
    expect(html).toContain('href="/painel"');
    expect(html).toContain('aria-current="page"');
  });

  it("Mês (fechar o mês) fica dentro do Painel: o item Painel fica ativo em /mes", () => {
    path.value = "/mes/estoque";
    const html = renderToStaticMarkup(<BottomNav locks={open} />);
    expect(html).toMatch(/href="\/painel"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/painel"/);
  });

  it("Custos fica ativo em /custos e nas abas dele", () => {
    path.value = "/custos/impostos";
    const html = renderToStaticMarkup(<BottomNav locks={open} />);
    expect(html).toMatch(/href="\/custos"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/custos"/);
  });
});

describe("abas travadas", () => {
  it("Cardápio digital (Custos) e Cupons (Painel) aparecem sempre; sem cardápio conectado ficam travados", () => {
    const costs = renderToStaticMarkup(<CostsTabs active="fixed" menu={false} />);
    expect(costs).toContain("Custos fixos");
    expect(costs).toContain("Impostos e meta");
    expect(costs).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Cardápio digital/);
    const painel = renderToStaticMarkup(<PainelTabs active="resumo" showCoupons={false} />);
    expect(painel).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Cupons/);
  });

  it("com cardápio conectado, as duas abas viram links", () => {
    expect(renderToStaticMarkup(<CostsTabs active="fixed" menu />)).toContain('href="/custos/cardapio"');
    const painel = renderToStaticMarkup(<PainelTabs active="resumo" showCoupons />);
    expect(painel).toContain('href="/painel/cupons"');
    expect(painel).not.toContain("aria-disabled");
  });
});
