import { describe, expect, it } from "vitest";
import { analyzeCoupons, maxDiscountPct, type CouponGroupInput } from "./coupon-view";

// Impostos e taxas de 8%, margem mínima de 10%. Marmita de frango: custo 8,50, preço 19,90.
const costPerSale = new Map<string, number | null>([
  ["frango", 8.5],
  ["kit10", 85], // kit com 10 marmitas, custo do combo inteiro
  ["semficha", null],
]);

const group = (over: Partial<CouponGroupInput> & Pick<CouponGroupInput, "code">): CouponGroupInput => ({ orders: 0, discount: 0, gross: 0, net: 0, products: [], ...over });

const base = (groups: CouponGroupInput[], over: Partial<Parameters<typeof analyzeCoupons>[0]> = {}) =>
  analyzeCoupons({ groups, costPerSale, variablePct: 0.08, minMarginPct: 0.1, totalOrders: 100, baseline: [{ productId: "frango", qty: 160, net: 160 * 19.9 }], ...over });

describe("inteligência de cupom", () => {
  it("cupom de 10% numa marmita saudável: ainda sobra, mas menos", () => {
    // 10 pedidos de 1 frango a 19,90 com BEM10 (desconto 1,99 cada): paga 17,91
    const g = group({ code: "BEM10", orders: 10, discount: 19.9, gross: 199, net: 179.1, products: [{ productId: "frango", qty: 10, gross: 199, net: 179.1 }] });
    const a = base([g]);
    const r = a.reports[0];
    expect(r.discountPct).toBeCloseTo(0.1, 5);
    expect(r.contribution).toBeCloseTo(179.1 - 85 - 179.1 * 0.08, 4); // 79,77
    expect(r.marginBefore).toBeCloseTo((199 - 85 - 199 * 0.08) / 199, 5);
    expect(r.marginAfter!).toBeLessThan(r.marginBefore!);
    expect(r.profitLost).toBeCloseTo(19.9 * 0.92, 4); // o desconto comeu 92% de seu valor da sobra (o resto iria para imposto)
    expect(r.verdict).toBe("ok");
    expect(r.coverage).toBe(1);
  });

  it("cupom grande demais dá prejuízo", () => {
    // frango pago a 9,95 (50% de desconto): 9,95 − 8,50 − 0,80 = 0,65 por marmita... com 60%: pago 7,96 => prejuízo
    const g = group({ code: "BOMBA60", orders: 5, discount: 59.7, gross: 99.5, net: 39.8, products: [{ productId: "frango", qty: 5, gross: 99.5, net: 39.8 }] });
    const r = base([g]).reports[0];
    expect(r.contribution).toBeLessThan(0);
    expect(r.verdict).toBe("loss");
  });

  it("margem pequena, mas positiva, é margem baixa", () => {
    // pago 10,10 por marmita: 10,10 − 8,50 − 0,808 = 0,79 (7,8% < 10%)
    const g = group({ code: "META50", orders: 4, discount: 39.2, gross: 79.6, net: 40.4, products: [{ productId: "frango", qty: 4, gross: 79.6, net: 40.4 }] });
    expect(base([g]).reports[0].verdict).toBe("low");
  });

  it("produto sem ficha: a parte vinculada define o veredito; pouco vinculado = não dá para avaliar", () => {
    const g = group({
      code: "MISTO",
      orders: 3,
      discount: 30,
      gross: 300,
      net: 270,
      products: [
        { productId: "frango", qty: 3, gross: 60, net: 54 },
        { productId: "semficha", qty: 5, gross: 240, net: 216 },
      ],
    });
    const r = base([g]).reports[0];
    expect(r.coverage).toBeCloseTo(54 / 270, 5);
    expect(r.verdict).toBe("unknown");
  });

  it("combo vinculado entra pelo custo do combo inteiro", () => {
    const g = group({ code: "KIT5", orders: 2, discount: 20, gross: 400, net: 380, products: [{ productId: "kit10", qty: 2, gross: 400, net: 380 }] });
    const r = base([g]).reports[0];
    expect(r.contribution).toBeCloseTo(380 - 170 - 380 * 0.08, 4);
    expect(r.verdict).toBe("ok");
  });

  it("ordena do pior para o melhor", () => {
    const loss = group({ code: "A", orders: 1, discount: 10, gross: 20, net: 10, products: [{ productId: "frango", qty: 1, gross: 20, net: 10 }] });
    const ok = group({ code: "B", orders: 9, discount: 50, gross: 900, net: 850, products: [{ productId: "kit10", qty: 4, gross: 900, net: 850 }] });
    expect(base([ok, loss]).reports.map((r) => r.code)).toEqual(["A", "B"]);
  });

  it("totais do mês: participação, desconto médio, ticket com e sem cupom, margem com e sem", () => {
    const g = group({ code: "BEM10", orders: 20, discount: 39.8, gross: 398, net: 358.2, products: [{ productId: "frango", qty: 20, gross: 398, net: 358.2 }] });
    const a = base([g]);
    expect(a.couponOrders).toBe(20);
    expect(a.totalOrders).toBe(100);
    expect(a.discount).toBeCloseTo(39.8, 5);
    expect(a.avgDiscountPerOrder).toBeCloseTo(1.99, 5);
    expect(a.ticketWith).toBeCloseTo(358.2 / 20, 5);
    expect(a.ticketWithout).toBeCloseTo((160 * 19.9) / 80, 5);
    expect(a.marginWithout).toBeCloseTo((19.9 - 8.5 - 19.9 * 0.08) / 19.9, 5);
    expect(a.marginWith!).toBeLessThan(a.marginWithout!);
    expect(a.profitLost).toBeGreaterThan(0);
  });

  it("pedidos antigos ainda sem código ficam separados", () => {
    const a = base([group({ code: "?", orders: 7, discount: 70, gross: 700, net: 630 }), group({ code: "BEM10", orders: 3, discount: 6, gross: 60, net: 54 })]);
    expect(a.pendingCode).toBe(7);
  });

  it("mês sem cupons não divide por zero", () => {
    const a = base([], { totalOrders: 0, baseline: [] });
    expect(a.couponOrders).toBe(0);
    expect(a.discountPct).toBeNull();
    expect(a.ticketWith).toBeNull();
    expect(a.marginWith).toBeNull();
    expect(a.reports).toEqual([]);
  });
});

describe("quanto desconto a marmita aguenta", () => {
  it("frango a 19,90 (custo 8,50), 8% de impostos e margem mínima de 10%", () => {
    // piso = 8,50 / (1 − 0,08 − 0,10) = 10,366 => desconto máximo ≈ 47,9%
    expect(maxDiscountPct({ price: 19.9, cost: 8.5, variablePct: 0.08, minMarginPct: 0.1 })).toBeCloseTo(1 - 10.3659 / 19.9, 3);
  });
  it("custo já alto: aguenta pouco ou nada", () => {
    expect(maxDiscountPct({ price: 12, cost: 11, variablePct: 0.08, minMarginPct: 0.1 })).toBe(0);
  });
  it("conta impossível (impostos + margem passam de 100%)", () => {
    expect(maxDiscountPct({ price: 20, cost: 5, variablePct: 0.6, minMarginPct: 0.5 })).toBeNull();
  });
});
