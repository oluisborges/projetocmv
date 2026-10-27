import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { FichasReport } from "@/lib/fichas-report";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";

const C = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", muted: "#475569", line: "#CBD5E1", ink: "#0F172A", green: "#15803D", red: "#B91C1C" };

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 54, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: C.lime },
  logo: { width: 110 },
  kicker: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1, textAlign: "right" },
  org: { fontSize: 10, color: C.muted, textAlign: "right", marginTop: 1 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.deep, marginTop: 16 },
  sub: { fontSize: 9, color: C.muted, marginTop: 2 },
  th: { flexDirection: "row", backgroundColor: C.teal, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 3, marginTop: 14 },
  thText: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  right: { textAlign: "right" },
  totals: { flexDirection: "row", gap: 10, marginTop: 16 },
  box: { flex: 1, backgroundColor: C.tint, borderRadius: 6, padding: 10 },
  boxLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  boxValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 3 },
  note: { fontSize: 8, color: C.muted, marginTop: 14, lineHeight: 1.4 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 },
});

export async function fichasToPdf(report: FichasReport): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    logo = fs.readFileSync(path.join(process.cwd(), "public", "brand", "logo-horizontal.png"));
  } catch {
    logo = null;
  }
  const date = report.generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return renderToBuffer(
    <Document title={`Fichas técnicas · ${report.orgName}`} author="Precificaí · Grupo Shogun">
      {report.fichas.map((f) => (
        <Page key={f.name} size="A4" style={s.page}>
          <View style={s.head} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não é <img> */}
          {logo ? <Image src={{ data: logo, format: "png" }} style={s.logo} /> : <Text>Precificaí</Text>}
            <View>
              <Text style={s.kicker}>Ficha técnica</Text>
              <Text style={s.org}>{report.orgName}</Text>
            </View>
          </View>

          <Text style={s.title}>{f.name}</Text>
          <Text style={s.sub}>
            {f.category ? `${f.category} · ` : ""}
            {f.mode === "serving" ? "Quantidades de uma marmita" : `Receita em lote${f.portions ? ` que rende ${formatNumber(f.portions, 0)} porções` : ""}`}
          </Text>

          <View style={s.th}>
            <Text style={[s.thText, { flex: 1 }]}>Insumo</Text>
            <Text style={[s.thText, s.right, { width: 90 }]}>Quantidade</Text>
            <Text style={[s.thText, s.right, { width: 80 }]}>Custo</Text>
          </View>
          {f.lines.map((l, i) => (
            <View key={`${l.ingredient}-${i}`} style={s.row} wrap={false}>
              <Text style={{ flex: 1 }}>
                {l.ingredient}
                {l.kind === "embalagem" ? "  (embalagem)" : l.kind === "receita" ? "  (receita)" : ""}
              </Text>
              <Text style={[s.right, { width: 90 }]}>
                {formatNumber(l.qty, 3)} {l.unit}
              </Text>
              <Text style={[s.right, { width: 80 }]}>{f.cost !== null ? formatBRL(l.cost) : "—"}</Text>
            </View>
          ))}
          {f.lines.length === 0 ? <Text style={s.note}>Esta ficha ainda não tem insumos.</Text> : null}

          <View style={s.totals} wrap={false}>
            <View style={s.box}>
              <Text style={s.boxLabel}>Custo por marmita</Text>
              <Text style={s.boxValue}>{f.cost !== null ? formatBRL(f.cost) : "ficha incompleta"}</Text>
            </View>
            <View style={s.box}>
              <Text style={s.boxLabel}>Preço de venda</Text>
              <Text style={s.boxValue}>{f.price !== null ? formatBRL(f.price) : "—"}</Text>
            </View>
            <View style={s.box}>
              <Text style={s.boxLabel}>Lucro líquido</Text>
              <Text style={[s.boxValue, { color: f.netPct === null ? C.ink : f.netPct >= 0 ? C.green : C.red }]}>{f.netPct !== null ? formatPct(f.netPct, 1) : "—"}</Text>
            </View>
          </View>
          <Text style={s.note}>O custo inclui a margem de segurança configurada. O lucro líquido desconta impostos, taxas e a parte das despesas fixas.</Text>

          <View style={s.footer} fixed>
            <Text>Precificaí · por Grupo Shogun · gerado em {date}</Text>
            <Text render={({ pageNumber, totalPages }) => `Ficha ${pageNumber} de ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>,
  );
}

/** Mesmo formato da planilha de importação (Ficha, Insumo, Quantidade, Unidade) mais o custo: serve de cópia de segurança. */
export async function fichasToXlsx(report: FichasReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Precificaí · Grupo Shogun";
  const ws = wb.addWorksheet("Fichas", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  ws.columns = [{ width: 38 }, { width: 38 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 18 }];
  const head = ws.addRow(["Ficha", "Insumo", "Quantidade", "Unidade", "Custo por marmita", "Categoria"]);
  head.height = 24;
  head.eachCell((c, i) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    c.alignment = { vertical: "middle", horizontal: i === 1 || i === 2 || i === 6 ? "left" : "right" };
  });
  let n = 0;
  for (const f of report.fichas) {
    for (const l of f.lines) {
      const row = ws.addRow([f.name, l.ingredient, l.qty, l.unit, f.cost !== null ? l.cost : null, f.category ?? ""]);
      row.getCell(3).numFmt = "#,##0.###";
      row.getCell(5).numFmt = '"R$" #,##0.0000';
      if (n % 2 === 1) row.eachCell({ includeEmpty: true }, (c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4F1" } }));
      n++;
    }
  }
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  const sum = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  sum.columns = [{ width: 38 }, { width: 18 }, { width: 18 }, { width: 16 }];
  const h2 = sum.addRow(["Marmita", "Custo", "Preço de venda", "Lucro líquido"]);
  h2.eachCell((c, i) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    c.alignment = { horizontal: i === 1 ? "left" : "right" };
  });
  for (const f of report.fichas) {
    const row = sum.addRow([f.name, f.cost, f.price, f.netPct]);
    row.getCell(2).numFmt = '"R$" #,##0.00';
    row.getCell(3).numFmt = '"R$" #,##0.00';
    row.getCell(4).numFmt = "0.0%";
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
