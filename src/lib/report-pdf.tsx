import fs from "node:fs";
import path from "node:path";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { monthLabel } from "@/lib/month-view";
import type { Report } from "@/lib/report-data";

const C = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", muted: "#475569", line: "#CBD5E1", ink: "#0F172A", green: "#15803D", red: "#B91C1C" };

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 54, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: C.lime },
  logo: { width: 130 },
  headRight: { alignItems: "flex-end" },
  kicker: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.deep, marginTop: 2 },
  org: { fontSize: 10, color: C.muted, marginTop: 1 },
  kpis: { flexDirection: "row", gap: 10, marginTop: 16 },
  kpi: { flex: 1, backgroundColor: C.tint, borderRadius: 6, padding: 10 },
  kpiLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiSub: { fontSize: 8, color: C.muted, marginTop: 2 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.deep, marginTop: 18, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  th: { flexDirection: "row", backgroundColor: C.teal, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 3 },
  thText: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  right: { textAlign: "right" },
  muted: { color: C.muted },
  note: { fontSize: 8, color: C.muted, marginTop: 10, lineHeight: 1.4 },
  bar: { height: 5, borderRadius: 3, backgroundColor: C.teal },
  barBg: { height: 5, borderRadius: 3, backgroundColor: C.line, width: 90 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6 },
});

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

function Flow({ label, value, pct, strong }: { label: string; value: number | null; pct: number | null; strong?: boolean }) {
  return (
    <View style={s.row} wrap={false}>
      <Text style={{ flex: 1, fontFamily: strong ? "Helvetica-Bold" : "Helvetica" }}>{label}</Text>
      <View style={s.barBg}>{pct !== null ? <View style={[s.bar, { width: `${Math.max(0, Math.min(1, pct)) * 100}%` }]} /> : null}</View>
      <Text style={[s.right, { width: 52, marginLeft: 8, color: C.muted }]}>{pct !== null ? formatPct(pct, 0) : "—"}</Text>
      <Text style={[s.right, { width: 82, fontFamily: strong ? "Helvetica-Bold" : "Helvetica" }]}>{value !== null ? formatBRL(value) : "—"}</Text>
    </View>
  );
}

function ReportDocument({ r, logo }: { r: Report; logo: Buffer | null }) {
  const month = cap(monthLabel(r.month));
  const rev = r.revenue.total;
  const pct = (v: number | null) => (v !== null && rev > 0 ? v / rev : null);
  const resultColor = r.result ? (r.result.value >= 0 ? C.green : C.red) : C.ink;
  return (
    <Document title={`Relatório de ${month} · ${r.orgName}`} author="Precificaí · Grupo Shogun">
      <Page size="A4" style={s.page}>
        <View style={s.head} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não é <img> */}
          {logo ? <Image src={{ data: logo, format: "png" }} style={s.logo} /> : <Text style={s.title}>Precificaí</Text>}
          <View style={s.headRight}>
            <Text style={s.kicker}>Relatório do mês</Text>
            <Text style={s.title}>{month}</Text>
            <Text style={s.org}>{r.orgName}</Text>
          </View>
        </View>

        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Faturamento</Text>
            <Text style={s.kpiValue}>{formatBRL(rev)}</Text>
            <Text style={s.kpiSub}>{r.revenue.orders > 0 ? `${formatNumber(r.revenue.orders, 0)} pedidos no cardápio` : "informado em Fechar o mês"}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Resultado estimado</Text>
            <Text style={[s.kpiValue, { color: resultColor }]}>{r.result ? formatBRL(r.result.value) : "—"}</Text>
            <Text style={s.kpiSub}>{r.result ? `${formatPct(r.result.pct, 1)} do faturamento` : "faltam compras ou custos do mês"}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Marmitas vendidas</Text>
            <Text style={s.kpiValue}>{formatNumber(r.soldUnits, 0)}</Text>
            <Text style={s.kpiSub}>{r.soldUnits > 0 && rev > 0 ? `${formatBRL(rev / r.soldUnits)} por marmita` : " "}</Text>
          </View>
        </View>

        <Text style={s.h2}>Para onde foi o dinheiro</Text>
        <Flow label="Faturamento" value={rev} pct={rev > 0 ? 1 : null} strong />
        <Flow label="Compras de insumos" value={r.purchases} pct={pct(r.purchases)} />
        <Flow label="Mão de obra (equipe)" value={r.staffValue} pct={pct(r.staffValue)} />
        <Flow label="Contas fixas" value={r.fixedValue} pct={pct(r.fixedValue)} />
        <Flow label="Impostos e taxas" value={r.taxesValue} pct={pct(r.taxesValue)} />
        <Flow label="Resultado estimado" value={r.result?.value ?? null} pct={r.result ? Math.max(0, r.result.pct) : null} strong />
        <Text style={s.note}>
          {r.hasSnapshot
            ? "Custos e preços são médias do mês: cada valor conta pelo tempo em que valeu. O resultado é uma estimativa que usa as compras do mês."
            : "Este mês não tinha custos e preços guardados: aparece só o que foi informado em Fechar o mês."}
          {r.expectedPct !== null && r.insumosPct !== null ? ` Insumos: compras ${formatPct(r.insumosPct)} do faturamento; as fichas esperavam ${formatPct(r.expectedPct)}.` : ""}
        </Text>

        {r.products.length > 0 ? (
          <>
            <Text style={s.h2}>Marmitas</Text>
            <View style={s.th} wrap={false}>
              <Text style={[s.thText, { flex: 1 }]}>Marmita</Text>
              <Text style={[s.thText, s.right, { width: 62 }]}>Custo</Text>
              <Text style={[s.thText, s.right, { width: 62 }]}>Preço</Text>
              <Text style={[s.thText, s.right, { width: 56 }]}>Insumos</Text>
              <Text style={[s.thText, s.right, { width: 52 }]}>Vendidas</Text>
            </View>
            {r.products.slice(0, 30).map((p) => (
              <View key={p.name} style={s.row} wrap={false}>
                <Text style={{ flex: 1 }}>{p.name}</Text>
                <Text style={[s.right, { width: 62 }]}>{p.cost !== null ? formatBRL(p.cost) : "—"}</Text>
                <Text style={[s.right, { width: 62 }]}>{p.price !== null ? formatBRL(p.price) : "—"}</Text>
                <Text style={[s.right, { width: 56 }, s.muted]}>{p.costPct !== null ? formatPct(p.costPct, 0) : "—"}</Text>
                <Text style={[s.right, { width: 52 }]}>{formatNumber(p.sold, 0)}</Text>
              </View>
            ))}
            {r.products.length > 30 ? <Text style={s.note}>+ {r.products.length - 30} marmitas no arquivo Excel.</Text> : null}
          </>
        ) : null}

        {r.moves.length > 0 ? (
          <>
            <Text style={s.h2}>Insumos que mudaram de preço no mês</Text>
            {r.moves.map((m) => (
              <View key={m.name} style={s.row} wrap={false}>
                <Text style={{ flex: 1 }}>{m.name}</Text>
                <Text style={[s.right, { width: 70, color: m.pct > 0 ? C.red : C.green, fontFamily: "Helvetica-Bold" }]}>
                  {m.pct > 0 ? "+" : "−"}
                  {formatPct(Math.abs(m.pct), 0)}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {r.stock ? (
          <>
            <Text style={s.h2}>CMV real (com a contagem de estoque)</Text>
            <Flow label="Gastou em insumos" value={r.stock.cogs} pct={pct(r.stock.cogs)} strong />
            <Flow label="As fichas esperavam" value={r.stock.theoretical} pct={pct(r.stock.theoretical)} />
            <Flow label={r.stock.gap !== null && r.stock.gap < 0 ? "Gastou a menos" : "Sumiu além do esperado"} value={r.stock.gap} pct={null} strong />
          </>
        ) : null}

        <View style={s.footer} fixed>
          <Text>Precificaí · por Grupo Shogun · gerado em {r.generatedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function reportToPdf(report: Report): Promise<Buffer> {
  let logo: Buffer | null = null;
  try {
    logo = fs.readFileSync(path.join(process.cwd(), "public", "brand", "logo-horizontal.png"));
  } catch {
    logo = null;
  }
  return renderToBuffer(<ReportDocument r={report} logo={logo} />);
}
