import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Document, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { FichaLine, FichaTecnica } from "@/lib/ficha-tecnica";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";

const C = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", zebra: "#F3F8F7", muted: "#475569", line: "#CBD5E1", ink: "#0F172A", amber: "#92400E", amberBg: "#FEF3C7" };

const brand = (file: string): Buffer | null => {
  try {
    return fs.readFileSync(path.join(process.cwd(), "public", "brand", file));
  } catch {
    return null;
  }
};

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 70, paddingHorizontal: 38, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  org: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.deep },
  kicker: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 1.4, marginTop: 2 },
  date: { fontSize: 8, color: C.muted, textAlign: "right" },
  bar: { height: 3, backgroundColor: C.lime, marginTop: 10, borderRadius: 2 },
  title: { fontSize: 23, fontFamily: "Helvetica-Bold", color: C.deep, marginTop: 18 },
  chips: { flexDirection: "row", gap: 6, marginTop: 8 },
  chip: { backgroundColor: C.tint, color: C.deep, fontSize: 8.5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10 },
  cards: { flexDirection: "row", gap: 8, marginTop: 16 },
  card: { flex: 1, backgroundColor: C.tint, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10 },
  cardLabel: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.7 },
  cardValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.deep, marginTop: 3 },
  cardSub: { fontSize: 7.5, color: C.muted, marginTop: 1 },
  section: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20 },
  sectionDot: { width: 8, height: 8, backgroundColor: C.lime, borderRadius: 2 },
  sectionTitle: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.teal },
  th: { flexDirection: "row", backgroundColor: C.teal, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 4, marginTop: 7 },
  thText: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  row: { flexDirection: "row", paddingVertical: 5.5, paddingHorizontal: 6, alignItems: "center" },
  tag: { fontSize: 6.5, color: C.teal, borderWidth: 0.6, borderColor: C.teal, borderRadius: 6, paddingVertical: 0.5, paddingHorizontal: 4, marginLeft: 5 },
  right: { textAlign: "right" },
  totalsWrap: { alignItems: "flex-end", marginTop: 12 },
  totals: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, paddingHorizontal: 4 },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, paddingHorizontal: 8, marginTop: 4, backgroundColor: C.teal, borderRadius: 5 },
  warn: { backgroundColor: C.amberBg, color: C.amber, fontSize: 8.5, padding: 8, borderRadius: 6, marginTop: 14, lineHeight: 1.4 },
  noteLine: { borderBottomWidth: 0.6, borderBottomColor: C.line, borderBottomStyle: "dashed", height: 17 },
  footer: { position: "absolute", left: 38, right: 38, bottom: 18, alignItems: "center" },
  footerLine: { height: 0.6, backgroundColor: C.line, alignSelf: "stretch", marginBottom: 8 },
  footerRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerSmall: { fontSize: 7.5, color: C.muted, width: 90 },
});

/** O "P" do Precificaí, em vetor (nítido em qualquer zoom e na impressão). */
function Mark({ size = 34 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 120 128" style={{ width: size, height: (size * 128) / 120 }}>
      <Path d="M36 6H84A30 30 0 0 1 114 36V58A30 30 0 0 1 84 88H48A6 6 0 0 0 42 94V112A10 10 0 0 1 32 122H16A10 10 0 0 1 6 112V36A30 30 0 0 1 36 6Z" fill={C.teal} />
      <Path
        d="M30 40V37A7 7 0 0 1 37 30H54V27A2.5 2.5 0 0 1 56.5 24.5H63.5A2.5 2.5 0 0 1 66 27V30H83A7 7 0 0 1 90 37V40Z M27.5 43H92.5A3.5 3.5 0 0 1 96 46.5A3.5 3.5 0 0 1 92.5 50H90A20 20 0 0 1 70 70H50A20 20 0 0 1 30 50H27.5A3.5 3.5 0 0 1 24 46.5A3.5 3.5 0 0 1 27.5 43Z"
        fill="#FFFFFF"
      />
      <Path d="M50 55L57.5 62.5L71 49" fill="none" stroke={C.lime} strokeWidth={8.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const money = (v: number | null) => (v === null ? "—" : formatBRL(v));
const dateBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

function Table({ title, lines }: { title: string; lines: FichaLine[] }) {
  return (
    <View wrap={false}>
      <View style={s.section}>
        <View style={s.sectionDot} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.th}>
        <Text style={[s.thText, { flex: 1 }]}>Ingrediente</Text>
        <Text style={[s.thText, s.right, { width: 70 }]}>Peso líquido</Text>
        <Text style={[s.thText, s.right, { width: 34 }]}>FC</Text>
        <Text style={[s.thText, s.right, { width: 70 }]}>Peso bruto</Text>
        <Text style={[s.thText, s.right, { width: 62 }]}>Custo</Text>
      </View>
      {lines.map((l, i) => (
        <View key={`${l.name}-${i}`} style={[s.row, i % 2 === 0 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Text>{l.name}</Text>
            {l.tag === "receita" ? <Text style={s.tag}>receita</Text> : null}
          </View>
          <Text style={[s.right, { width: 70 }]}>{l.net}</Text>
          <Text style={[s.right, { width: 34, color: C.muted }]}>{formatNumber(l.factor, 2)}</Text>
          <Text style={[s.right, { width: 70 }]}>{l.gross}</Text>
          <Text style={[s.right, { width: 62, fontFamily: "Helvetica-Bold" }]}>{money(l.cost)}</Text>
        </View>
      ))}
    </View>
  );
}

function summaryCards(f: FichaTecnica): { label: string; value: string; sub?: string }[] {
  if (f.receita) {
    return [
      { label: "Rende pronta", value: f.receita.yield },
      { label: "Custo do lote", value: money(f.totals.total) },
      { label: f.receita.perUnitLabel, value: money(f.receita.perUnit) },
      { label: f.receita.per100Label, value: money(f.receita.per100) },
    ];
  }
  return [
    { label: "Custo por marmita", value: money(f.totals.total), sub: f.totals.safety > 0 ? `com ${formatPct(f.totals.safetyPct, 0)} de margem de segurança` : undefined },
    { label: "Peso da porção", value: f.portionWeight ?? "—", sub: f.portionWeight ? "aproximado, só o que tem peso" : undefined },
    { label: "Preço de venda", value: f.price !== null ? formatBRL(f.price) : "—" },
    { label: "CMV", value: f.cmvPct !== null ? formatPct(f.cmvPct) : "—", sub: f.cmvPct !== null ? "custo ÷ preço de venda" : undefined },
  ];
}

/** Ficha técnica em PDF (A4): marca no topo, tabela de ingredientes, totais, espaço para o modo de preparo e a assinatura da marca no rodapé. */
export async function fichaToPdf(f: FichaTecnica, orgName: string, generatedAt: Date = new Date()): Promise<Buffer> {
  const logo = brand("logo-powered-by-shogun.png");
  return renderToBuffer(
    <Document title={`Ficha técnica · ${f.name}`} author="Precificaí · Grupo Shogun" subject={orgName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <Mark />
            <View>
              <Text style={s.org}>{orgName}</Text>
              <Text style={s.kicker}>Ficha técnica</Text>
            </View>
          </View>
          <Text style={s.date}>{dateBR(generatedAt)}</Text>
        </View>
        <View style={s.bar} />

        <Text style={s.title}>{f.name}</Text>
        <View style={s.chips}>
          {f.category ? <Text style={s.chip}>{f.category}</Text> : null}
          <Text style={s.chip}>{f.typeLabel}</Text>
        </View>

        <View style={s.cards}>
          {summaryCards(f).map((c) => (
            <View key={c.label} style={s.card}>
              <Text style={s.cardLabel}>{c.label}</Text>
              <Text style={s.cardValue}>{c.value}</Text>
              {c.sub ? <Text style={s.cardSub}>{c.sub}</Text> : null}
            </View>
          ))}
        </View>

        {f.lines.length > 0 ? <Table title="Ingredientes" lines={f.lines} /> : null}
        {f.packaging.length > 0 ? <Table title="Embalagens" lines={f.packaging} /> : null}

        {f.receita ? (
          <View style={s.totalsWrap} wrap={false}>
            <View style={s.totals}>
              <View style={s.totalFinal}>
                <Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>Custo do lote</Text>
                <Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>{money(f.totals.total)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.totalsWrap} wrap={false}>
            <View style={s.totals}>
              <View style={s.totalRow}>
                <Text style={{ color: C.muted }}>Ingredientes</Text>
                <Text>{money(f.totals.ingredients)}</Text>
              </View>
              {f.packaging.length > 0 ? (
                <View style={s.totalRow}>
                  <Text style={{ color: C.muted }}>Embalagem</Text>
                  <Text>{money(f.totals.packaging)}</Text>
                </View>
              ) : null}
              {f.totals.safety > 0 ? (
                <View style={s.totalRow}>
                  <Text style={{ color: C.muted }}>Margem de segurança ({formatPct(f.totals.safetyPct, 0)})</Text>
                  <Text>{money(f.totals.safety)}</Text>
                </View>
              ) : null}
              <View style={s.totalFinal}>
                <Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>Custo por marmita</Text>
                <Text style={{ color: "#FFFFFF", fontFamily: "Helvetica-Bold" }}>{money(f.totals.total)}</Text>
              </View>
            </View>
          </View>
        )}

        {f.warnings.length > 0 ? <Text style={s.warn}>Atenção: {f.warnings.join(" ")}</Text> : null}

        <View wrap={false}>
          <View style={s.section}>
            <View style={s.sectionDot} />
            <Text style={s.sectionTitle}>Modo de preparo e observações</Text>
          </View>
          <View style={{ marginTop: 6 }}>
            {Array.from({ length: Math.max(5, Math.min(10, 12 - f.lines.length - f.packaging.length)) }, (_, i) => (
              <View key={i} style={s.noteLine} />
            ))}
          </View>
        </View>

        <View style={s.footer} fixed>
          <View style={s.footerLine} />
          <View style={s.footerRow}>
            <Text style={s.footerSmall}>{orgName}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não é <img> */}
            {logo ? <Image src={{ data: logo, format: "png" }} style={{ width: 112, height: 32 }} /> : <Text style={{ fontSize: 9, color: C.teal }}>Precificaí · powered by Grupo Shogun</Text>}
            <Text style={[s.footerSmall, s.right]} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>,
  );
}

const XL = { teal: "FF0F766E", deep: "FF0B4D4B", lime: "FF9ACB39", tint: "FFE6F4F1", zebra: "FFF3F8F7", muted: "FF475569", white: "FFFFFFFF", amberBg: "FFFEF3C7", amber: "FF92400E" };
const BRL = '"R$" #,##0.00';

/** A mesma ficha em Excel, com a marca no topo e no fim. */
export async function fichaToXlsx(f: FichaTecnica, orgName: string, generatedAt: Date = new Date()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Precificaí · Grupo Shogun";
  wb.created = generatedAt;
  const ws = wb.addWorksheet("Ficha técnica", { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 38 }, { width: 12 }, { width: 15 }, { width: 8 }, { width: 15 }, { width: 14 }];

  // Topo: o P + nome da marmitaria
  const icon = brand("icon-192.png");
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  if (icon) {
    const id = wb.addImage({ buffer: icon as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.05, row: 0.1 }, ext: { width: 44, height: 44 } });
  }
  ws.mergeCells("B1:F1");
  ws.getCell("B1").value = orgName;
  ws.getCell("B1").font = { name: "Calibri", size: 18, bold: true, color: { argb: XL.deep } };
  ws.getCell("B1").alignment = { vertical: "middle", indent: 1 };
  ws.mergeCells("B2:F2");
  ws.getCell("B2").value = `FICHA TÉCNICA  ·  ${generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
  ws.getCell("B2").font = { name: "Calibri", size: 9, color: { argb: XL.muted } };
  ws.getCell("B2").alignment = { vertical: "middle", indent: 1 };
  ws.getRow(3).height = 4;
  for (let c = 1; c <= 6; c++) ws.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.lime } };

  ws.mergeCells("A5:F5");
  ws.getCell("A5").value = f.name;
  ws.getCell("A5").font = { name: "Calibri", size: 20, bold: true, color: { argb: XL.deep } };
  ws.getRow(5).height = 30;
  ws.mergeCells("A6:F6");
  ws.getCell("A6").value = [f.category, f.typeLabel].filter(Boolean).join("  ·  ");
  ws.getCell("A6").font = { name: "Calibri", size: 10, color: { argb: XL.muted } };

  let r = 8;
  const cards = summaryCards(f);
  const cardCols: [number, number][] = [[1, 1], [2, 3], [4, 5], [6, 6]];
  cards.forEach((c, i) => {
    const [a, b] = cardCols[i];
    if (a !== b) {
      ws.mergeCells(r, a, r, b);
      ws.mergeCells(r + 1, a, r + 1, b);
    }
    const label = ws.getCell(r, a);
    const value = ws.getCell(r + 1, a);
    label.value = c.label.toUpperCase();
    label.font = { name: "Calibri", size: 8, color: { argb: XL.muted } };
    value.value = c.value;
    value.font = { name: "Calibri", size: 14, bold: true, color: { argb: XL.deep } };
    for (let col = a; col <= b; col++) {
      ws.getCell(r, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.tint } };
      ws.getCell(r + 1, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.tint } };
    }
    label.alignment = { indent: 1, vertical: "middle" };
    value.alignment = { indent: 1, vertical: "middle", horizontal: "left" };
  });
  ws.getRow(r + 1).height = 26;
  r += 3;

  const writeTable = (title: string, lines: FichaLine[]) => {
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = title;
    ws.getCell(r, 1).font = { name: "Calibri", size: 12, bold: true, color: { argb: XL.teal } };
    r++;
    const head = ["Ingrediente", "Tipo", "Peso líquido", "FC", "Peso bruto", "Custo"];
    head.forEach((h, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = h;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: XL.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.teal } };
      cell.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle", indent: i === 0 ? 1 : 0 };
    });
    ws.getRow(r).height = 20;
    r++;
    lines.forEach((l, i) => {
      const vals: (string | number | null)[] = [l.name, l.tag === "receita" ? "Receita" : l.tag === "embalagem" ? "Embalagem" : "Insumo", l.net, Math.round(l.factor * 100) / 100, l.gross, l.cost];
      vals.forEach((v, c) => {
        const cell = ws.getCell(r, c + 1);
        cell.value = v;
        cell.font = { name: "Calibri", size: 10, bold: c === 5 };
        cell.alignment = { horizontal: c >= 2 ? "right" : "left", vertical: "middle", indent: c === 0 ? 1 : 0 };
        if (c === 5) cell.numFmt = BRL;
        if (c === 3) cell.numFmt = "0.00";
        if (i % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.zebra } };
      });
      r++;
    });
    r++;
  };
  if (f.lines.length > 0) writeTable("Ingredientes", f.lines);
  if (f.packaging.length > 0) writeTable("Embalagens", f.packaging);

  // Totais
  const totalRow = (label: string, value: number | null, strong = false) => {
    ws.mergeCells(r, 1, r, 5);
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).alignment = { horizontal: "right" };
    const v = ws.getCell(r, 6);
    v.value = value;
    v.numFmt = BRL;
    for (const cell of [ws.getCell(r, 1), v]) {
      cell.font = { name: "Calibri", size: strong ? 12 : 10, bold: strong, color: { argb: strong ? XL.white : "FF0F172A" } };
      if (strong) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.teal } };
    }
    if (strong) for (let c = 2; c <= 5; c++) ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.teal } };
    r++;
  };
  if (f.receita) {
    totalRow("Custo do lote", f.totals.total, true);
  } else {
    totalRow("Ingredientes", f.totals.ingredients);
    if (f.packaging.length > 0) totalRow("Embalagem", f.totals.packaging);
    if (f.totals.safety > 0) totalRow(`Margem de segurança (${formatPct(f.totals.safetyPct, 0)})`, f.totals.safety);
    totalRow("Custo por marmita", f.totals.total, true);
  }
  r++;

  if (f.warnings.length > 0) {
    ws.mergeCells(r, 1, r, 6);
    ws.getCell(r, 1).value = `Atenção: ${f.warnings.join(" ")}`;
    ws.getCell(r, 1).font = { name: "Calibri", size: 10, color: { argb: XL.amber } };
    ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.amberBg } };
    ws.getCell(r, 1).alignment = { wrapText: true, vertical: "middle", indent: 1 };
    ws.getRow(r).height = 32;
    r += 2;
  }

  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = "Modo de preparo e observações";
  ws.getCell(r, 1).font = { name: "Calibri", size: 12, bold: true, color: { argb: XL.teal } };
  r++;
  for (let i = 0; i < 6; i++) {
    for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = { bottom: { style: "dotted", color: { argb: "FFCBD5E1" } } };
    ws.getRow(r).height = 22;
    r++;
  }
  r += 1;

  const logo = brand("logo-powered-by-shogun.png");
  if (logo) {
    const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 1.2, row: r }, ext: { width: 200, height: 57 } });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}


