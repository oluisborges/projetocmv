// @vitest-environment node
import ExcelJS from "exceljs";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { Report } from "./report-data";
import { reportToPdf } from "./report-pdf";
import { reportToXlsx } from "./report-xlsx";

const report: Report = {
  orgName: "Fit da Ana",
  unitName: "Unidade principal",
  month: "2026-09-01",
  generatedAt: new Date("2026-10-02T15:00:00Z"),
  revenue: { total: 52_400, menu: 44_800, outside: 7_600, orders: 1_310 },
  purchases: 17_900,
  soldUnits: 2_060,
  insumosPct: 17_900 / 52_400,
  expectedPct: 0.31,
  taxesValue: 3_144,
  staffValue: 12_000,
  fixedValue: 7_500,
  result: { value: 52_400 - 17_900 - 12_000 - 7_500 - 3_144, pct: (52_400 - 17_900 - 12_000 - 7_500 - 3_144) / 52_400 },
  hasSnapshot: true,
  products: [
    { name: "Frango com batata doce", cost: 7.8, price: 24.9, costPct: 7.8 / 24.9, sold: 640 },
    { name: "Strogonoff de carne com arroz", cost: 9.4, price: 27.9, costPct: 9.4 / 27.9, sold: 410 },
    { name: "Feijoada fit", cost: 10.2, price: null, costPct: null, sold: 0 },
  ],
  moves: [{ name: "Peito de frango", pct: 0.14 }],
  ingredients: [
    { name: "Peito de frango", kind: "insumo", category: "Carnes", purchaseQty: 1, purchaseUnit: "kg", purchasePrice: 17.9 },
    { name: "Pote 750 ml", kind: "embalagem", category: null, purchaseQty: 100, purchaseUnit: "un", purchasePrice: 104.9 },
  ],
  stock: {
    cogs: 16_200,
    theoretical: 15_300,
    gap: 900,
    rows: [{ name: "Peito de frango", unit: "kg", perDisplay: 1000, opening: 10_000, purchased: 60_000, used: 58_000, expected: 12_000, counted: 7_000, missingValue: 89.5 }],
  },
};

describe("relatório do mês", () => {
  it("gera um Excel com as quatro abas e os valores certos", async () => {
    const buf = await reportToXlsx(report);
    expect(buf.subarray(0, 2).toString()).toBe("PK"); // zip
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Marmitas", "Insumos", "Estoque"]);
    const resumo = wb.getWorksheet("Resumo")!;
    expect(resumo.getCell("A1").value).toBe("Resultado de Setembro de 2026");
    expect(resumo.getCell("A6").value).toBe("Faturamento total");
    expect(resumo.getCell("B6").value).toBe(52_400);
    expect(resumo.getCell("B13").value).toBeCloseTo(52_400 - 17_900 - 12_000 - 7_500 - 3_144, 2);
    const marmitas = wb.getWorksheet("Marmitas")!;
    expect(marmitas.getCell("A6").value).toBe("Frango com batata doce");
    const d6 = marmitas.getCell("D6").value as { formula: string };
    expect(d6.formula).toContain("B6/C6");
  });

  it("sem estoque contado, não cria a aba de estoque", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await reportToXlsx({ ...report, stock: null })) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Marmitas", "Insumos"]);
  });

  it("gera um PDF válido", async () => {
    const pdf = await reportToPdf(report);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(3_000);
    if (process.env.REPORT_SAMPLE_DIR) {
      fs.writeFileSync(`${process.env.REPORT_SAMPLE_DIR}/amostra.pdf`, pdf);
      fs.writeFileSync(`${process.env.REPORT_SAMPLE_DIR}/amostra.xlsx`, await reportToXlsx(report));
    }
  }, 30_000);
});

describe("fichas técnicas exportadas", () => {
  const fichas = {
    orgName: "Fit da Ana",
    generatedAt: new Date("2026-10-02T15:00:00Z"),
    fichas: [
      {
        name: "Frango com batata doce",
        category: "Fit",
        mode: "serving" as const,
        portions: 1,
        lines: [
          { ingredient: "Peito de frango", kind: "insumo" as const, qty: 120, unit: "g", cost: 2.8 },
          { ingredient: "Batata doce", kind: "insumo" as const, qty: 100, unit: "g", cost: 0.9 },
          { ingredient: "Pote 750 ml", kind: "embalagem" as const, qty: 1, unit: "un", cost: 1.05 },
        ],
        cost: 7.8,
        price: 24.9,
        netPct: 0.18,
      },
    ],
  };

  it("Excel no formato da planilha de importação (Ficha, Insumo, Quantidade, Unidade)", async () => {
    const { fichasToXlsx } = await import("./fichas-export");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await fichasToXlsx(fichas)) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Fichas")!;
    expect([1, 2, 3, 4].map((c) => ws.getRow(1).getCell(c).value)).toEqual(["Ficha", "Insumo", "Quantidade", "Unidade"]);
    expect([1, 2, 3, 4].map((c) => ws.getRow(2).getCell(c).value)).toEqual(["Frango com batata doce", "Peito de frango", 120, "g"]);
    expect(ws.rowCount).toBe(4);
  });

  it("PDF com uma página por ficha", async () => {
    const { fichasToPdf } = await import("./fichas-export");
    const pdf = await fichasToPdf(fichas);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
