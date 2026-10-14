import { describe, expect, it } from "vitest";
import { comboCost, comboPrice, comboPriceRange, comboUnits, type ComboGroup } from "./combo";

describe("combo fixo (kit de uma marmita só)", () => {
  // Carne moída low carb: custa R$ 11,73; kits com preço por unidade caindo (planilha da Hibiscus).
  const kit = (n: number, unitPrice: number): ComboGroup[] => [{ kind: "fixed", options: [{ cost: 11.729, qty: n, unitPrice }] }];

  it("kit de 5, 10, 20 e 30: preço total, unidades e custo", () => {
    expect(comboPrice(kit(5, 23.5)).toNumber()).toBeCloseTo(117.5, 10);
    expect(comboPrice(kit(10, 23)).toNumber()).toBeCloseTo(230, 10);
    expect(comboPrice(kit(20, 22.5)).toNumber()).toBeCloseTo(450, 10);
    expect(comboPrice(kit(30, 22)).toNumber()).toBeCloseTo(660, 10);
    expect(comboUnits(kit(20, 22.5))).toBe(20);
    expect(comboCost(kit(5, 23.5)).cost.toNumber()).toBeCloseTo(58.645, 10);
  });

  it("o preço por marmita cai e o gasto com insumos sobe conforme o kit cresce", () => {
    const cmv = (n: number, p: number) => comboCost(kit(n, p)).cost.div(comboPrice(kit(n, p))).toNumber();
    expect(cmv(5, 23.5)).toBeCloseTo(0.4991, 3); // 49,9% (igual ao da planilha)
    expect(cmv(30, 22)).toBeCloseTo(0.5331, 3); // 53,3%
  });
});

describe("combo com várias marmitas fixas (semanal)", () => {
  it("soma o preço e o custo de cada uma", () => {
    const semanal: ComboGroup[] = [
      {
        kind: "fixed",
        options: [
          { cost: 8.32, qty: 1, unitPrice: 21 },
          { cost: 8.19, qty: 1, unitPrice: 21 },
          { cost: 11.73, qty: 2, unitPrice: 21.5 },
        ],
      },
    ];
    expect(comboUnits(semanal)).toBe(4);
    expect(comboPrice(semanal).toNumber()).toBeCloseTo(21 + 21 + 43, 10);
    expect(comboCost(semanal).cost.toNumber()).toBeCloseTo(8.32 + 8.19 + 23.46, 10);
  });
});

describe("grupo de escolha", () => {
  // "Escolha 10 marmitas": frango R$ 5, carne R$ 9, low carb R$ 12.
  const options = [{ cost: 5 }, { cost: 9 }, { cost: 12 }];
  const group = (weights?: number[]): ComboGroup[] => [{ kind: "choice", pickQty: 10, unitPrice: 22, options: options.map((o, i) => ({ ...o, weight: weights?.[i] })) }];

  it("sem vendas, usa a média simples e mostra melhor e pior caso", () => {
    const c = comboCost(group());
    expect(c.cost.toNumber()).toBeCloseTo(((5 + 9 + 12) / 3) * 10, 10);
    expect(c.min.toNumber()).toBe(50);
    expect(c.max.toNumber()).toBe(120);
    expect(comboPrice(group()).toNumber()).toBe(220);
    expect(comboUnits(group())).toBe(10);
  });

  it("com vendas, a marmita mais vendida pesa mais no custo", () => {
    const c = comboCost(group([80, 15, 5])); // 80% frango, 15% carne, 5% low carb
    expect(c.cost.toNumber()).toBeCloseTo((5 * 0.8 + 9 * 0.15 + 12 * 0.05) * 10, 10); // 59,5
    expect(c.cost.toNumber()).toBeLessThan(comboCost(group()).cost.toNumber());
  });

  it("opção sem custo (ficha incompleta) fica de fora e avisa", () => {
    const g: ComboGroup[] = [{ kind: "choice", pickQty: 2, unitPrice: 20, options: [{ cost: 6 }, { cost: null }] }];
    const c = comboCost(g);
    expect(c.incomplete).toBe(true);
    expect(c.cost.toNumber()).toBe(12);
  });
});

describe("combo misto", () => {
  it("fixo + escolha somam preço, unidades e custo", () => {
    const g: ComboGroup[] = [
      { kind: "fixed", options: [{ cost: 10, qty: 2, unitPrice: 25 }] },
      { kind: "choice", pickQty: 3, unitPrice: 24, options: [{ cost: 6 }, { cost: 8 }] },
    ];
    expect(comboUnits(g)).toBe(5);
    expect(comboPrice(g).toNumber()).toBe(2 * 25 + 3 * 24);
    expect(comboCost(g).cost.toNumber()).toBeCloseTo(20 + 3 * 7, 10);
  });

  it("combo vazio não quebra", () => {
    expect(comboPrice([]).toNumber()).toBe(0);
    expect(comboUnits([])).toBe(0);
    expect(comboCost([]).cost.toNumber()).toBe(0);
  });
});

describe("grupo de escolha com preço diferente por marmita", () => {
  // Combo de 5: sabor A a R$ 20 e sabor B a R$ 19 (a cliente escolhe os 5 entre os dois).
  const combo5: ComboGroup[] = [{ kind: "choice", pickQty: 5, unitPrice: 20, options: [{ cost: 9, unitPrice: 20 }, { cost: 8, unitPrice: 19 }] }];

  it("sem vendas, o preço esperado é a média simples e a faixa vai de 5×B a 5×A", () => {
    expect(comboPrice(combo5).toNumber()).toBeCloseTo(97.5, 10);
    const r = comboPriceRange(combo5);
    expect(r.min.toNumber()).toBe(95);
    expect(r.max.toNumber()).toBe(100);
  });

  it("com vendas, a média pende para o que mais sai (A vende 3× mais)", () => {
    const g: ComboGroup[] = [{ kind: "choice", pickQty: 5, unitPrice: 20, options: [{ cost: 9, unitPrice: 20, weight: 30 }, { cost: 8, unitPrice: 19, weight: 10 }] }];
    expect(comboPrice(g).toNumber()).toBeCloseTo(5 * 19.75, 10);
  });

  it("opção sem preço próprio usa o preço do grupo", () => {
    const g: ComboGroup[] = [{ kind: "choice", pickQty: 10, unitPrice: 19, options: [{ cost: 9 }, { cost: 8, unitPrice: 18 }] }];
    expect(comboPrice(g).toNumber()).toBeCloseTo(185, 10);
    expect(comboPriceRange(g).min.toNumber()).toBe(180);
    expect(comboPriceRange(g).max.toNumber()).toBe(190);
  });
});
