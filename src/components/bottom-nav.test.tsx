import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const path = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));

import { BottomNav } from "./bottom-nav";
import { MarmitasTabs } from "@/components/marmitas-tabs";
import { CostsTabs } from "./costs-tabs";
import { PainelTabs } from "./painel-tabs";

const open = { producao: null };
const newAccount = {
  producao: { message: "A Produção é liberada depois que você cria a sua primeira marmita.", href: "/cardapio/nova", cta: "Criar marmita" },
};

describe("menu de baixo", () => {
  it("sempre mostra os 5 itens, inclusive com a Produção travada", () => {
    path.value = "/";
    for (const locks of [open, newAccount]) {
      const html = renderToStaticMarkup(<BottomNav locks={locks} />);
      for (const label of ["Início", "Cardápio", "Ingredientes", "Financeiro", "Produção"]) expect(html).toContain(`>${label}<`);
    }
  });

  it("Produção travada vira botão com cadeado (não leva para a tela) e o resto continua link", () => {
    path.value = "/";
    const html = renderToStaticMarkup(<BottomNav locks={newAccount} />);
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Produção/);
    expect(html).not.toContain('href="/producao"');
    for (const href of ["/", "/cardapio", "/ingredientes", "/financeiro"]) expect(html).toContain(`href="${href}"`);
  });

  it("tudo liberado: todos os itens são links", () => {
    path.value = "/";
    const html = renderToStaticMarkup(<BottomNav locks={open} />);
    for (const href of ["/", "/cardapio", "/ingredientes", "/financeiro", "/producao"]) expect(html).toContain(`href="${href}"`);
    expect(html).not.toContain("aria-disabled");
  });

  it("quem já está na tela do item nunca vê esse item travado", () => {
    path.value = "/producao/estoque";
    const html = renderToStaticMarkup(<BottomNav locks={newAccount} />);
    expect(html).toContain('href="/producao"');
    expect(html).toContain('aria-current="page"');
  });

  it("a Visão Avançada (/painel) fica dentro do Início", () => {
    path.value = "/painel/cupons";
    const html = renderToStaticMarkup(<BottomNav locks={open} />);
    expect(html).toMatch(/href="\/"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/"/);
  });

  it("Fechar o mês e a Contagem ficam dentro da Produção", () => {
    path.value = "/producao/contagem";
    const html = renderToStaticMarkup(<BottomNav locks={open} />);
    expect(html).toMatch(/href="\/producao"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/producao"/);
  });
});

describe("abas travadas", () => {
  it("Sincronizar Cardápio (Cardápio) e Cupons (Painel) aparecem sempre; sem cardápio conectado ficam travados", () => {
    const costs = renderToStaticMarkup(<CostsTabs active="fixed" />);
    expect(costs).toContain("Custos fixos");
    expect(costs).toContain("Impostos e meta");
    expect(costs).toContain("Histórico");
    expect(renderToStaticMarkup(<MarmitasTabs active="marmitas" connected={false} />)).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Sincronizar Cardápio/);
    const painel = renderToStaticMarkup(<PainelTabs active="resumo" showCoupons={false} />);
    expect(painel).toMatch(/<button[^>]*aria-disabled="true"[^>]*>[\s\S]*?Cupons/);
  });

  it("com cardápio conectado, as duas abas viram links", () => {
    expect(renderToStaticMarkup(<MarmitasTabs active="marmitas" connected />)).toContain('href="/cardapio/sincronizar"');
    const painel = renderToStaticMarkup(<PainelTabs active="resumo" showCoupons />);
    expect(painel).toContain('href="/painel/cupons"');
    expect(painel).not.toContain("aria-disabled");
  });
});
