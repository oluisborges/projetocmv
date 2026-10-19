import ExcelJS from "exceljs";
import { monthLabel } from "@/lib/month-view";
import type { Report } from "@/lib/report-data";

const TEAL = "FF0F766E";
const DEEP = "FF0B4D4B";
const LIME = "FF9ACB39";
const TINT = "FFE6F4F1";
const MUTED = "FF475569";
const BRL = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const BRL4 = '"R$" #,##0.0000';
const PCT = "0.0%";
const QTY = "#,##0.00";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function title(ws: ExcelJS.Worksheet, text: string, sub: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  const t = ws.getCell(1, 1);
  t.value = text;
  t.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DEEP } };
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells(2, 1, 2, cols);
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { name: "Calibri", size: 10, color: { argb: MUTED } };
  s.alignment = { indent: 1 };
  ws.getRow(3).height = 6;
  for (let c = 1; c <= cols; c++) ws.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIME } };
}

function header(ws: ExcelJS.Worksheet, row: number, labels: string[]) {
  labels.forEach((label, i) => {
    const c = ws.getCell(row, i + 1);
    c.value = label;
    c.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", wrapText: true };
    c.border = { bottom: { style: "thin", color: { argb: DEEP } } };
  });
  ws.getRow(row).height = 24;
}

function zebra(ws: ExcelJS.Worksheet, from: number, to: number, cols: number) {
  for (let r = from; r <= to; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: "Calibri", size: 11, ...(cell.font ?? {}) };
      cell.border = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
      if ((r - from) % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };
    }
  }
}

export async function reportToXlsx(report: Report): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Precificaí · Grupo Shogun";
  wb.created = report.generatedAt;
  const month = cap(monthLabel(report.month));
  const sub = `${report.orgName} · ${month} · gerado em ${report.generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

  // ---- Resumo
  const ws = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 42 }, { width: 18 }, { width: 14 }, { width: 52 }];
  title(ws, `Resultado de ${month}`, sub, 4);
  header(ws, 5, ["Item", "Valor (R$)", "% do faturamento", "Como é calculado"]);
  const rev = report.revenue.total;
  const pctOf = (v: number | null) => (v !== null && rev > 0 ? v / rev : null);
  const rows: [string, number | null, number | null, string][] = [
    ["Faturamento total", rev, rev > 0 ? 1 : null, "Cardápio digital + vendas por fora"],
    ["   Cardápio digital", report.revenue.menu, pctOf(report.revenue.menu), `${report.revenue.orders.toLocaleString("pt-BR")} pedidos, já descontados os cupons`],
    ["   Vendas por fora do cardápio", report.revenue.outside, pctOf(report.revenue.outside), "Informado em Fechar o mês"],
    ["Compras de insumos", report.purchases, pctOf(report.purchases), "Notas fiscais importadas + compras informadas"],
    ["Mão de obra (equipe)", report.staffValue, pctOf(report.staffValue), "Salários e encargos cadastrados em Custos, aba Custos fixos"],
    ["Contas fixas", report.fixedValue, pctOf(report.fixedValue), "Custos, aba Custos fixos: aluguel, energia, mensalidade do cardápio…"],
    ["Impostos e taxas", report.taxesValue, pctOf(report.taxesValue), "Percentuais definidos em Custos, aba Impostos e meta"],
    ["Resultado estimado", report.result?.value ?? null, report.result?.pct ?? null, "Faturamento − compras − equipe − contas fixas − impostos e taxas"],
  ];
  rows.forEach(([label, value, pct, how], i) => {
    const r = 6 + i;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 2).value = value;
    ws.getCell(r, 2).numFmt = BRL;
    ws.getCell(r, 3).value = pct;
    ws.getCell(r, 3).numFmt = PCT;
    ws.getCell(r, 4).value = how;
    ws.getCell(r, 4).font = { color: { argb: MUTED }, size: 10 };
    if (label === "Faturamento total" || label === "Resultado estimado") {
      for (let c = 1; c <= 3; c++) ws.getCell(r, c).font = { bold: true, size: 12 };
    }
  });
  zebra(ws, 6, 5 + rows.length, 4);
  const resultRow = 5 + rows.length;
  ws.getCell(resultRow, 4).font = { color: { argb: MUTED }, size: 10 };
  if (report.result) ws.getCell(resultRow, 2).font = { bold: true, size: 12, color: { argb: report.result.value >= 0 ? "FF15803D" : "FFB91C1C" } };

  const k = 6 + rows.length + 1;
  ws.getCell(k, 1).value = "Marmitas vendidas";
  ws.getCell(k, 2).value = report.soldUnits;
  ws.getCell(k, 2).numFmt = "#,##0";
  ws.getCell(k + 1, 1).value = "Insumos ÷ faturamento (compras)";
  ws.getCell(k + 1, 2).value = report.insumosPct;
  ws.getCell(k + 1, 2).numFmt = PCT;
  ws.getCell(k + 2, 1).value = "Insumos esperados pelas fichas ÷ faturamento";
  ws.getCell(k + 2, 2).value = report.expectedPct;
  ws.getCell(k + 2, 2).numFmt = PCT;
  zebra(ws, k, k + 2, 4);
  ws.mergeCells(k + 4, 1, k + 4, 4);
  const note = ws.getCell(k + 4, 1);
  note.value = report.hasSnapshot
    ? "Os custos e preços são médias do mês: cada valor conta pelo tempo em que valeu. O resultado é uma estimativa e usa as compras do mês."
    : "O app ainda não tinha guardado os custos e preços deste mês: aparece só o que foi informado em Fechar o mês.";
  note.font = { italic: true, size: 10, color: { argb: MUTED } };
  note.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(k + 4).height = 30;

  // ---- Marmitas
  const wp = wb.addWorksheet("Marmitas", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  wp.columns = [{ width: 40 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }];
  title(wp, `Marmitas em ${month}`, sub, 6);
  header(wp, 5, ["Marmita", "Custo médio", "Preço médio", "Insumos ÷ preço", "Vendidas", "Custo esperado (R$)"]);
  report.products.forEach((p, i) => {
    const r = 6 + i;
    wp.getCell(r, 1).value = p.name;
    wp.getCell(r, 2).value = p.cost;
    wp.getCell(r, 2).numFmt = BRL;
    wp.getCell(r, 3).value = p.price;
    wp.getCell(r, 3).numFmt = BRL;
    wp.getCell(r, 4).value = { formula: `IF(AND(ISNUMBER(B${r}),ISNUMBER(C${r}),C${r}>0),B${r}/C${r},"")`, result: p.costPct ?? "" };
    wp.getCell(r, 4).numFmt = PCT;
    wp.getCell(r, 5).value = p.sold;
    wp.getCell(r, 5).numFmt = "#,##0";
    wp.getCell(r, 6).value = { formula: `IF(ISNUMBER(B${r}),B${r}*E${r},"")`, result: p.cost !== null ? p.cost * p.sold : "" };
    wp.getCell(r, 6).numFmt = BRL;
  });
  zebra(wp, 6, 5 + report.products.length, 6);
  if (report.products.length === 0) wp.getCell(6, 1).value = "Sem marmitas com custo registrado neste mês.";

  // ---- Insumos
  const wi = wb.addWorksheet("Insumos", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
  wi.columns = [{ width: 38 }, { width: 14 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }];
  title(wi, "Insumos e preços de hoje", sub, 6);
  header(wi, 5, ["Insumo", "Tipo", "Categoria", "Quantidade", "Preço pago", "Preço por unidade"]);
  report.ingredients.forEach((g, i) => {
    const r = 6 + i;
    wi.getCell(r, 1).value = g.name;
    wi.getCell(r, 2).value = g.kind === "embalagem" ? "Embalagem" : "Insumo";
    wi.getCell(r, 3).value = g.category ?? "";
    wi.getCell(r, 4).value = `${g.purchaseQty.toLocaleString("pt-BR")} ${g.purchaseUnit}`;
    wi.getCell(r, 4).alignment = { horizontal: "right" };
    wi.getCell(r, 5).value = g.purchasePrice;
    wi.getCell(r, 5).numFmt = BRL;
    wi.getCell(r, 6).value = { formula: `IF(${g.purchaseQty}>0,E${r}/${g.purchaseQty},"")`, result: g.purchaseQty > 0 ? g.purchasePrice / g.purchaseQty : "" };
    wi.getCell(r, 6).numFmt = BRL4;
  });
  zebra(wi, 6, 5 + report.ingredients.length, 6);
  if (report.moves.length > 0) {
    const r = 7 + report.ingredients.length;
    wi.getCell(r, 1).value = "Mudaram de preço no mês";
    wi.getCell(r, 1).font = { bold: true, color: { argb: DEEP } };
    report.moves.forEach((m, i) => {
      wi.getCell(r + 1 + i, 1).value = m.name;
      wi.getCell(r + 1 + i, 5).value = m.pct;
      wi.getCell(r + 1 + i, 5).numFmt = '+0.0%;[Red]-0.0%';
    });
  }

  // ---- Estoque
  if (report.stock) {
    const wst = wb.addWorksheet("Estoque", { views: [{ state: "frozen", ySplit: 5, showGridLines: false }] });
    wst.columns = [{ width: 36 }, { width: 8 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 18 }];
    title(wst, `Estoque e CMV real de ${month}`, sub, 8);
    header(wst, 5, ["Insumo", "Un.", "Começo", "Comprado", "Usado (fichas)", "Deveria sobrar", "Contado", "Diferença (R$)"]);
    const q = (v: number, per: number) => v / per;
    report.stock.rows.forEach((s, i) => {
      const r = 6 + i;
      wst.getCell(r, 1).value = s.name;
      wst.getCell(r, 2).value = s.unit;
      wst.getCell(r, 2).alignment = { horizontal: "right" };
      wst.getCell(r, 3).value = q(s.opening, s.perDisplay);
      wst.getCell(r, 4).value = q(s.purchased, s.perDisplay);
      wst.getCell(r, 5).value = q(s.used, s.perDisplay);
      wst.getCell(r, 6).value = { formula: `C${r}+D${r}-E${r}`, result: q(s.expected, s.perDisplay) };
      wst.getCell(r, 7).value = s.counted === null ? null : q(s.counted, s.perDisplay);
      wst.getCell(r, 8).value = s.missingValue;
      for (const c of [3, 4, 5, 6, 7]) wst.getCell(r, c).numFmt = QTY;
      wst.getCell(r, 8).numFmt = BRL;
    });
    zebra(wst, 6, 5 + report.stock.rows.length, 8);
    const r = 7 + report.stock.rows.length;
    wst.getCell(r, 1).value = "CMV real (gasto em insumos)";
    wst.getCell(r, 8).value = report.stock.cogs;
    wst.getCell(r + 1, 1).value = "Esperado pelas fichas";
    wst.getCell(r + 1, 8).value = report.stock.theoretical;
    wst.getCell(r + 2, 1).value = "Diferença";
    wst.getCell(r + 2, 8).value = report.stock.gap;
    for (let i = 0; i < 3; i++) {
      wst.getCell(r + i, 8).numFmt = BRL;
      wst.getCell(r + i, 1).font = { bold: true };
    }
  }

  for (const sheet of wb.worksheets) {
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.headerFooter = { oddFooter: "&LPrecificaí · Grupo Shogun&RPágina &P de &N" };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
