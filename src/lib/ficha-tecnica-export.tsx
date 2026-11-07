import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Document, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { FichaLine, FichaTecnica } from "@/lib/ficha-tecnica";
import { CAMPOS_PADRAO, type FichaCampos } from "@/lib/ficha-campos";
import { fichaDocNome } from "@/lib/ficha-nome";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";

export const C = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", zebra: "#F3F8F7", muted: "#475569", line: "#CBD5E1", ink: "#0F172A", amber: "#92400E", amberBg: "#FEF3C7" };

export const brand = (file: string): Buffer | null => {
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
export function Mark({ size = 34 }: { size?: number }) {
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

/** A foto guardada (JPEG em base64) como bytes, para o PDF e o Excel. */
const photoBytes = (f: FichaTecnica, campos: FichaCampos): Buffer | null => (campos.foto && f.photo ? Buffer.from(f.photo.slice(f.photo.indexOf(",") + 1), "base64") : null);
/** Título do espaço de texto: a receita tem "modo de preparo"; o produto, "passo a passo da montagem". */
const instructionsTitle = (f: FichaTecnica) => (f.kind === "marmita" ? "Passo a passo da montagem e observações" : "Modo de preparo e observações");

const money = (v: number | null) => (v === null ? "—" : formatBRL(v));
export const dateBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" });

function Table({ title, lines, campos }: { title: string; lines: FichaLine[]; campos: FichaCampos }) {
  return (
    <View wrap={false}>
      <View style={s.section}>
        <View style={s.sectionDot} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.th}>
        <Text style={[s.thText, { flex: 1 }]}>Ingrediente</Text>
        {campos.pesoLiquido ? <Text style={[s.thText, s.right, { width: 70 }]}>Peso líquido</Text> : null}
        {campos.fc ? <Text style={[s.thText, s.right, { width: 34 }]}>FC</Text> : null}
        {campos.pesoBruto ? <Text style={[s.thText, s.right, { width: 70 }]}>Peso bruto</Text> : null}
        {campos.custo ? <Text style={[s.thText, s.right, { width: 62 }]}>Custo</Text> : null}
      </View>
      {lines.map((l, i) => (
        <View key={`${l.name}-${i}`} style={[s.row, i % 2 === 0 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Text>{l.name}</Text>
            {l.tag === "receita" ? <Text style={s.tag}>receita</Text> : null}
          </View>
          {campos.pesoLiquido ? <Text style={[s.right, { width: 70 }]}>{l.net}</Text> : null}
          {campos.fc ? <Text style={[s.right, { width: 34, color: C.muted }]}>{formatNumber(l.factor, 2)}</Text> : null}
          {campos.pesoBruto ? <Text style={[s.right, { width: 70 }]}>{l.gross}</Text> : null}
          {campos.custo ? <Text style={[s.right, { width: 62, fontFamily: "Helvetica-Bold" }]}>{money(l.cost)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Os quadros do topo que a pessoa marcou. Em receita, "peso da porção" vira o rendimento e "custo por marmita" o custo do lote. */
function summaryCards(f: FichaTecnica, campos: FichaCampos): { label: string; value: string; sub?: string }[] {
  const cards: { label: string; value: string; sub?: string }[] = [];
  if (f.receita) {
    if (campos.pesoPorcao) cards.push({ label: "Rende pronta", value: f.receita.yield });
    if (campos.custoPorMarmita) {
      cards.push({ label: "Custo do lote", value: money(f.totals.total) });
      cards.push({ label: f.receita.perUnitLabel, value: money(f.receita.perUnit) });
      cards.push({ label: f.receita.per100Label, value: money(f.receita.per100) });
    }
    return cards;
  }
  if (campos.custoPorMarmita) cards.push({ label: "Custo por marmita", value: money(f.totals.total), sub: f.totals.safety > 0 ? `com ${formatPct(f.totals.safetyPct, 0)} de margem de segurança` : undefined });
  if (campos.pesoPorcao) cards.push({ label: "Peso da porção", value: f.portionWeight ?? "—", sub: f.portionWeight ? "aproximado, só o que tem peso" : undefined });
  if (campos.precoVenda) cards.push({ label: "Preço de venda", value: f.price !== null ? formatBRL(f.price) : "—" });
  if (campos.cmv) cards.push({ label: "CMV", value: f.cmvPct !== null ? formatPct(f.cmvPct) : "—", sub: f.cmvPct !== null ? "custo ÷ preço de venda" : undefined });
  return cards;
}

/** Avisos de custo só interessam a quem vê custo, preço ou CMV. */
const mostraCusto = (c: FichaCampos) => c.custo || c.custoPorMarmita || c.precoVenda || c.cmv;

/** Ficha técnica em PDF (A4): marca no topo, tabela de ingredientes, totais, espaço para o modo de preparo e a assinatura da marca no rodapé. */
export async function fichaToPdf(f: FichaTecnica, orgName: string, generatedAt: Date = new Date(), campos: FichaCampos = CAMPOS_PADRAO): Promise<Buffer> {
  const logo = brand("logo-powered-by-shogun.png");
  const cards = summaryCards(f, campos);
  const showTotals = campos.custo || campos.custoPorMarmita;
  const photo = photoBytes(f, campos);
  return renderToBuffer(
    <Document title={`${fichaDocNome(f.kind)} · ${f.name}`} author="Precificaí · Grupo Shogun" subject={orgName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <Mark />
            <View>
              <Text style={s.org}>{orgName}</Text>
              <Text style={s.kicker}>{fichaDocNome(f.kind)}</Text>
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

        {photo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não é <img>
          <Image src={{ data: photo, format: "jpg" }} style={{ width: 210, height: 150, objectFit: "cover", borderRadius: 8, marginTop: 14 }} />
        ) : null}

        {cards.length > 0 ? (
          <View style={s.cards}>
            {cards.map((c) => (
              <View key={c.label} style={s.card}>
                <Text style={s.cardLabel}>{c.label}</Text>
                <Text style={s.cardValue}>{c.value}</Text>
                {c.sub ? <Text style={s.cardSub}>{c.sub}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {campos.ingredientes && f.lines.length > 0 ? <Table title="Ingredientes" lines={f.lines} campos={campos} /> : null}
        {campos.embalagens && f.packaging.length > 0 ? <Table title="Embalagens" lines={f.packaging} campos={campos} /> : null}

        {!showTotals ? null : f.receita ? (
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
              {campos.custo ? (
                <View style={s.totalRow}>
                  <Text style={{ color: C.muted }}>Ingredientes</Text>
                  <Text>{money(f.totals.ingredients)}</Text>
                </View>
              ) : null}
              {campos.custo && f.packaging.length > 0 ? (
                <View style={s.totalRow}>
                  <Text style={{ color: C.muted }}>Embalagem</Text>
                  <Text>{money(f.totals.packaging)}</Text>
                </View>
              ) : null}
              {campos.custo && f.totals.safety > 0 ? (
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

        {mostraCusto(campos) && f.warnings.length > 0 ? <Text style={s.warn}>Atenção: {f.warnings.join(" ")}</Text> : null}

        {campos.modoPreparo ? (
          <View wrap={false}>
            <View style={s.section}>
              <View style={s.sectionDot} />
              <Text style={s.sectionTitle}>{instructionsTitle(f)}</Text>
            </View>
            {f.instructions ? (
              <Text style={{ marginTop: 6, lineHeight: 1.5 }}>{f.instructions}</Text>
            ) : (
              <View style={{ marginTop: 6 }}>
                {Array.from({ length: Math.max(5, Math.min(10, 12 - f.lines.length - f.packaging.length)) }, (_, i) => (
                  <View key={i} style={s.noteLine} />
                ))}
              </View>
            )}
            {f.kind === "marmita" ? (
              <View style={{ flexDirection: "row", gap: 14, marginTop: 12 }}>
                {["Peso final", "Lote", "Validade"].map((label) => (
                  <View key={label} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</Text>
                    <View style={{ borderBottomWidth: 0.8, borderBottomColor: C.muted, height: 16 }} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

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

type XlCol = { key: "name" | "tipo" | "net" | "fc" | "gross" | "cost"; head: string; width: number };

/** As colunas da tabela seguem os campos marcados (nome e tipo sempre ficam). */
function xlColumns(campos: FichaCampos): XlCol[] {
  const cols: XlCol[] = [
    { key: "name", head: "Ingrediente", width: 38 },
    { key: "tipo", head: "Tipo", width: 12 },
  ];
  if (campos.pesoLiquido) cols.push({ key: "net", head: "Peso líquido", width: 15 });
  if (campos.fc) cols.push({ key: "fc", head: "FC", width: 8 });
  if (campos.pesoBruto) cols.push({ key: "gross", head: "Peso bruto", width: 15 });
  if (campos.custo) cols.push({ key: "cost", head: "Custo", width: 14 });
  return cols;
}

/** A mesma ficha em Excel, com a marca no topo e no fim. */
export async function fichaToXlsx(f: FichaTecnica, orgName: string, generatedAt: Date = new Date(), campos: FichaCampos = CAMPOS_PADRAO): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Precificaí · Grupo Shogun";
  wb.created = generatedAt;
  const ws = wb.addWorksheet(fichaDocNome(f.kind), { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const cols = xlColumns(campos);
  const n = cols.length;
  ws.columns = cols.map((c) => ({ width: c.width }));
  const merge = (row: number, a: number, b: number) => {
    if (a < b) ws.mergeCells(row, a, row, b);
  };

  // Topo: o P + nome da marmitaria
  const icon = brand("icon-192.png");
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  if (icon) {
    const id = wb.addImage({ buffer: icon as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 0.05, row: 0.1 }, ext: { width: 44, height: 44 } });
  }
  merge(1, 2, n);
  ws.getCell("B1").value = orgName;
  ws.getCell("B1").font = { name: "Calibri", size: 18, bold: true, color: { argb: XL.deep } };
  ws.getCell("B1").alignment = { vertical: "middle", indent: 1 };
  merge(2, 2, n);
  ws.getCell("B2").value = `${fichaDocNome(f.kind).toUpperCase()}  ·  ${generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
  ws.getCell("B2").font = { name: "Calibri", size: 9, color: { argb: XL.muted } };
  ws.getCell("B2").alignment = { vertical: "middle", indent: 1 };
  ws.getRow(3).height = 4;
  for (let c = 1; c <= n; c++) ws.getCell(3, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.lime } };

  merge(5, 1, n);
  ws.getCell("A5").value = f.name;
  ws.getCell("A5").font = { name: "Calibri", size: 20, bold: true, color: { argb: XL.deep } };
  ws.getRow(5).height = 30;
  merge(6, 1, n);
  ws.getCell("A6").value = [f.category, f.typeLabel].filter(Boolean).join("  ·  ");
  ws.getCell("A6").font = { name: "Calibri", size: 10, color: { argb: XL.muted } };

  let r = 8;
  const cards = summaryCards(f, campos);
  // Os quadros dividem as colunas por igual; se forem mais que as colunas, quebram em mais de uma linha.
  const perRow = Math.max(1, Math.min(cards.length, n));
  for (let start = 0; start < cards.length; start += perRow) {
    const rowCards = cards.slice(start, start + perRow);
    rowCards.forEach((c, i) => {
      const a = Math.floor((i * n) / rowCards.length) + 1;
      const b = Math.floor(((i + 1) * n) / rowCards.length);
      merge(r, a, b);
      merge(r + 1, a, b);
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
  }
  if (cards.length === 0) r = 8;

  const photo = photoBytes(f, campos);
  if (photo) {
    const imageId = wb.addImage({ buffer: photo as unknown as ExcelJS.Buffer, extension: "jpeg" });
    ws.addImage(imageId, { tl: { col: 0.1, row: r - 1 }, ext: { width: 210, height: 150 } });
    for (let k = 0; k < 8; k++) ws.getRow(r + k).height = 20;
    r += 9;
  }

  const writeTable = (title: string, lines: FichaLine[]) => {
    merge(r, 1, n);
    ws.getCell(r, 1).value = title;
    ws.getCell(r, 1).font = { name: "Calibri", size: 12, bold: true, color: { argb: XL.teal } };
    r++;
    cols.forEach((col, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = col.head;
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: XL.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.teal } };
      cell.alignment = { horizontal: i >= 2 ? "right" : "left", vertical: "middle", indent: i === 0 ? 1 : 0 };
    });
    ws.getRow(r).height = 20;
    r++;
    lines.forEach((l, i) => {
      cols.forEach((col, c) => {
        const cell = ws.getCell(r, c + 1);
        cell.value =
          col.key === "name" ? l.name
          : col.key === "tipo" ? (l.tag === "receita" ? "Receita" : l.tag === "embalagem" ? "Embalagem" : "Insumo")
          : col.key === "net" ? l.net
          : col.key === "fc" ? Math.round(l.factor * 100) / 100
          : col.key === "gross" ? l.gross
          : l.cost;
        cell.font = { name: "Calibri", size: 10, bold: col.key === "cost" };
        cell.alignment = { horizontal: c >= 2 ? "right" : "left", vertical: "middle", indent: c === 0 ? 1 : 0 };
        if (col.key === "cost") cell.numFmt = BRL;
        if (col.key === "fc") cell.numFmt = "0.00";
        if (i % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.zebra } };
      });
      r++;
    });
    r++;
  };
  if (campos.ingredientes && f.lines.length > 0) writeTable("Ingredientes", f.lines);
  if (campos.embalagens && f.packaging.length > 0) writeTable("Embalagens", f.packaging);

  // Totais (o valor fica na última coluna)
  const totalRow = (label: string, value: number | null, strong = false) => {
    merge(r, 1, n - 1);
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).alignment = { horizontal: "right" };
    const v = ws.getCell(r, n);
    v.value = value;
    v.numFmt = BRL;
    for (const cell of [ws.getCell(r, 1), v]) {
      cell.font = { name: "Calibri", size: strong ? 12 : 10, bold: strong, color: { argb: strong ? XL.white : "FF0F172A" } };
      if (strong) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.teal } };
    }
    if (strong) for (let c = 2; c < n; c++) ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.teal } };
    r++;
  };
  if (campos.custo || campos.custoPorMarmita) {
    if (f.receita) {
      totalRow("Custo do lote", f.totals.total, true);
    } else {
      if (campos.custo) {
        totalRow("Ingredientes", f.totals.ingredients);
        if (f.packaging.length > 0) totalRow("Embalagem", f.totals.packaging);
        if (f.totals.safety > 0) totalRow(`Margem de segurança (${formatPct(f.totals.safetyPct, 0)})`, f.totals.safety);
      }
      totalRow("Custo por marmita", f.totals.total, true);
    }
    r++;
  }

  if (mostraCusto(campos) && f.warnings.length > 0) {
    merge(r, 1, n);
    ws.getCell(r, 1).value = `Atenção: ${f.warnings.join(" ")}`;
    ws.getCell(r, 1).font = { name: "Calibri", size: 10, color: { argb: XL.amber } };
    ws.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.amberBg } };
    ws.getCell(r, 1).alignment = { wrapText: true, vertical: "middle", indent: 1 };
    ws.getRow(r).height = 32;
    r += 2;
  }

  if (campos.modoPreparo) {
    merge(r, 1, n);
    ws.getCell(r, 1).value = instructionsTitle(f);
    ws.getCell(r, 1).font = { name: "Calibri", size: 12, bold: true, color: { argb: XL.teal } };
    r++;
    if (f.instructions) {
      merge(r, 1, n);
      ws.getCell(r, 1).value = f.instructions;
      ws.getCell(r, 1).font = { name: "Calibri", size: 10 };
      ws.getCell(r, 1).alignment = { wrapText: true, vertical: "top", indent: 1 };
      ws.getRow(r).height = Math.min(400, 16 * (f.instructions.split("\n").length + Math.ceil(f.instructions.length / 90)));
      r += 2;
    } else {
      for (let i = 0; i < 6; i++) {
        for (let c = 1; c <= n; c++) ws.getCell(r, c).border = { bottom: { style: "dotted", color: { argb: "FFCBD5E1" } } };
        ws.getRow(r).height = 22;
        r++;
      }
      r += 1;
    }
  }

  const logo = brand("logo-powered-by-shogun.png");
  if (logo) {
    const id = wb.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    ws.addImage(id, { tl: { col: 1.2, row: r }, ext: { width: 200, height: 57 } });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
