import { describe, expect, it } from "vitest";
import * as cw from "./cardapioweb";
import * as pf from "./prefiro";
import { dedupeOrders, productKey, sameToken } from "./types";

describe("CardápioWeb", () => {
  const order: cw.CwOrderDetail = {
    id: 1234,
    status: "closed",
    total: 62.9,
    created_at: "2026-10-12T22:30:00-03:00",
    sales_channel: "cardapioweb",
    delivery_fee: 5,
    discounts: [{ total: 3 }],
    items: [
      { name: "Strogonoff 350g", item_id: 77, quantity: 2, total_price: 43.8, options: [{ name: "Arroz extra", option_id: 9, quantity: 1, unit_price: 2 }] },
      { name: "Frango grelhado 350g", item_id: 78, quantity: 1, total_price: 19.9 },
    ],
  };

  it("traduz o pedido fechado em venda", () => {
    const m = cw.mapOrder(order)!;
    expect(m.externalId).toBe("cw:1234");
    expect(m.total).toBe(62.9);
    expect(m.discount).toBe(3);
    expect(m.deliveryFee).toBe(5);
    expect(m.orderedAt).toBe("2026-10-13T01:30:00.000Z");
  });

  it("separa o item das opções, sem contar a opção duas vezes", () => {
    const lines = cw.mapOrder(order)!.lines;
    expect(lines).toHaveLength(3);
    const strog = lines.find((l) => l.name === "Strogonoff 350g")!;
    expect(strog).toMatchObject({ key: "id:77", kind: "item", qty: 2, total: 39.8 }); // 43,80 − 2 × 2,00 de arroz extra
    expect(lines.find((l) => l.name === "Arroz extra")).toMatchObject({ key: "id:9", kind: "option", qty: 2, total: 4 });
  });

  it("código do cupom: só desconto da categoria cupom, em maiúsculas", () => {
    const m = cw.mapOrder({ ...order, discounts: [{ category: "loyalty", total: 2 }, { category: "coupon", coupon_code: " bem10 ", total: 3 }] })!;
    expect(m.coupon).toBe("BEM10");
    expect(m.discount).toBe(5);
    expect(cw.mapOrder({ ...order, discounts: [{ category: "loyalty", coupon_code: "X", total: 2 }] })!.coupon).toBeNull();
    expect(cw.mapOrder({ ...order, discounts: null })!.coupon).toBeNull();
  });

  it("cancelado e em andamento não são venda", () => {
    expect(cw.mapOrder({ ...order, status: "canceled" })).toBeNull();
    expect(cw.mapOrder({ ...order, status: "confirmed" })).toBeNull();
  });

  it("rejeita pedido sem data ou com total inválido", () => {
    expect(cw.mapOrder({ ...order, created_at: "" })).toBeNull();
    expect(cw.mapOrder({ ...order, total: "abc" })).toBeNull();
  });

  it("webhook: só ORDER_CREATED e ORDER_STATUS_UPDATED com id válido", () => {
    expect(cw.webhookOrderId({ event_type: "ORDER_CREATED", order_id: 55 })).toBe("55");
    expect(cw.webhookOrderId({ event_type: "ORDER_STATUS_UPDATED", order_id: "56" })).toBe("56");
    expect(cw.webhookOrderId({ event_type: "OUTRO", order_id: 55 })).toBeNull();
    expect(cw.webhookOrderId({ event_type: "ORDER_CREATED", order_id: -1 })).toBeNull();
    expect(cw.webhookOrderId(null)).toBeNull();
  });

  it("divide seis meses em janelas de até 90 dias", () => {
    const w = cw.windows(new Date("2026-04-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
    expect(w).toHaveLength(3);
    expect(w[0].start).toBe("2026-04-01T00:00:00.000Z");
    expect(w[2].end).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("Prefiro Delivery", () => {
  const raw = {
    id: 9001,
    status: { sku: 4 },
    data: "2026-10-12 21:15:00",
    total: "62,90",
    desconto: "0",
    taxa_entrega: "5,00",
    itens: [
      { nome: "Strogonoff 350g", produto_id: 31, quantidade: 2, valor_total: 43.8, complementos: [{ nome: "Arroz extra", opcao_id: 4, quantidade: 1, valor_unitario: 2 }] },
      { nome: "Frango grelhado 350g", produto_id: 32, quantidade: 1, valor_total: 19.9 },
    ],
  };

  it("traduz o pedido entregue em venda com data de Brasília", () => {
    const m = pf.mapOrder(raw)!;
    expect(m.externalId).toBe("pf:9001");
    expect(m.total).toBe(62.9);
    expect(m.deliveryFee).toBe(5);
    expect(m.orderedAt).toBe("2026-10-13T00:15:00.000Z");
    expect(m.lines.map((l) => l.name)).toEqual(["Strogonoff 350g", "Arroz extra", "Frango grelhado 350g"]);
    expect(m.lines[0]).toMatchObject({ kind: "item", qty: 2, total: 39.8 });
  });

  it("cupom da Prefiro vem no campo cupom", () => {
    expect(pf.mapOrder({ ...raw, cupom: "frete gratis" })!.coupon).toBe("FRETE GRATIS");
    expect(pf.mapOrder({ ...raw, cupom: "" })!.coupon).toBeNull();
    expect(pf.mapOrder(raw)!.coupon).toBeNull();
  });

  it("status: solicitado fica de fora, cancelado e expirado nunca são venda", () => {
    expect(pf.orderState({ status: { sku: 1 } })).toBe("open");
    expect(pf.orderState({ status: { sku: 6 } })).toBe("open");
    expect(pf.orderState({ status: { sku: 5 } })).toBe("cancelled");
    expect(pf.orderState({ status: 8 })).toBe("cancelled");
    expect(pf.orderState({ status: { sku: 2 } })).toBe("sale");
    expect(pf.mapOrder({ ...raw, status: { sku: 1 } })).toBeNull();
  });

  it("aceita a hash pura ou a URL da API, e recusa outros domínios", () => {
    expect(pf.parseHash("abc123XYZ")).toBe("abc123XYZ");
    expect(pf.parseHash("https://api.prefirodelivery.com/abc123XYZ/v2")).toBe("abc123XYZ");
    expect(pf.parseHash("https://evil.example.com/abc123XYZ/v2")).toBeNull();
    expect(pf.parseHash("http://api.prefirodelivery.com/abc123XYZ/v2")).toBeNull();
    expect(pf.parseHash("ab")).toBeNull();
  });

  it("lê data com e sem fuso e recusa lixo", () => {
    expect(pf.toIso("2026-10-12 21:15")).toBe("2026-10-13T00:15:00.000Z");
    expect(pf.toIso("2026-10-12T21:15:00Z")).toBe("2026-10-12T21:15:00.000Z");
    expect(pf.toIso("ontem")).toBeNull();
  });

  it("webhook e corpo de resposta", () => {
    expect(pf.webhookOrderId({ referencia: "Novo pedido", dados: { id: 9001 } })).toBe("9001");
    expect(pf.webhookOrderId({})).toBe("");
    expect(pf.dataOf({ data: { id: 1 } })).toEqual([{ id: 1 }]);
    expect(pf.dataOf({ data: [{ id: 1 }, { id: 2 }] })).toHaveLength(2);
    expect(pf.dataOf(null)).toEqual([]);
  });
});

describe("comum", () => {
  it("chave do produto: usa o id; sem id, o nome sem acento nem caixa", () => {
    expect(productKey(77, "x")).toBe("id:77");
    expect(productKey("", "  Strogonoff   Médio ")).toBe("nm:strogonoff medio");
  });

  it("token do webhook em tempo constante", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("abc", "ab")).toBe(false);
    expect(sameToken("", "")).toBe(false);
  });
});

describe("nomes longos de produto (limite de 200 caracteres da tabela)", () => {
  const longo = "Observação do cliente ".repeat(30); // > 200

  it("CardápioWeb: nome de item e de opção são cortados em 200", () => {
    const lines = cw.mapLines([{ item_id: 1, name: longo, quantity: 1, total_price: 10, options: [{ option_id: 2, name: longo, quantity: 1, unit_price: 1 }] }]);
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.name.length).toBeLessThanOrEqual(200);
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.key.length).toBeLessThanOrEqual(200);
    }
  });

  it("Prefiro: complemento sem id usa o nome na chave, também limitada a 200", () => {
    const lines = pf.mapLines([{ produto_id: 1, nome: "Marmita", quantidade: 1, valor_total: 20, complementos: [{ nome: longo, quantidade: 1, valor_unitario: 0 }] }]);
    expect(lines[1].name.length).toBeLessThanOrEqual(200);
    expect(lines[1].key.length).toBeLessThanOrEqual(200);
  });
});

describe("pedido repetido no mesmo lote", () => {
  it("fica uma só vez (a última versão), senão o upsert do banco falha", () => {
    const out = dedupeOrders([
      { externalId: "cw:1", total: 10 },
      { externalId: "cw:2", total: 20 },
      { externalId: "cw:1", total: 12 },
    ]);
    expect(out).toEqual([{ externalId: "cw:1", total: 12 }, { externalId: "cw:2", total: 20 }]);
  });
});
