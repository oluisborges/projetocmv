import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { C, Mark, brand, dateBR } from "@/lib/ficha-tecnica-export";
import { formatNumber } from "@/lib/format";
import { productionDateLabel } from "@/lib/production-view";
import type { ProductionSheet } from "@/lib/production-sheet";

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
  section: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20 },
  sectionDot: { width: 8, height: 8, backgroundColor: C.lime, borderRadius: 2 },
  sectionTitle: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.teal },
  hint: { fontSize: 8, color: C.muted, marginTop: 3 },
  th: { flexDirection: "row", backgroundColor: C.teal, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 4, marginTop: 7 },
  thText: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8 },
  row: { flexDirection: "row", paddingVertical: 5.5, paddingHorizontal: 6, alignItems: "center" },
  right: { textAlign: "right" },
  box: { width: 14, height: 14, borderWidth: 0.8, borderColor: C.muted, borderRadius: 3 },
  fill: { width: 64, borderBottomWidth: 0.8, borderBottomColor: C.muted, height: 14 },
  receita: { marginTop: 9, borderWidth: 0.7, borderColor: C.line, borderRadius: 6, overflow: "hidden" },
  receitaHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.tint, paddingVertical: 6, paddingHorizontal: 8 },
  receitaName: { fontFamily: "Helvetica-Bold", color: C.deep, fontSize: 10.5 },
  receitaSub: { fontSize: 8.5, color: C.muted },
  warn: { backgroundColor: C.amberBg, color: C.amber, fontSize: 8.5, padding: 8, borderRadius: 6, marginTop: 14, lineHeight: 1.4 },
  noteLine: { borderBottomWidth: 0.6, borderBottomColor: C.line, borderBottomStyle: "dashed", height: 17 },
  footer: { position: "absolute", left: 38, right: 38, bottom: 18, alignItems: "center" },
  footerLine: { height: 0.6, backgroundColor: C.line, alignSelf: "stretch", marginBottom: 8 },
  footerRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerSmall: { fontSize: 7.5, color: C.muted, width: 90 },
});

const Section = ({ title, hint }: { title: string; hint?: string }) => (
  <View>
    <View style={s.section}>
      <View style={s.sectionDot} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {hint ? <Text style={s.hint}>{hint}</Text> : null}
  </View>
);

/**
 * Ficha de produção em PDF (A4): o que produzir (com espaço para anotar o que saiu de verdade), o que preparar em lote
 * (receitas já com os insumos multiplicados) e o que comprar.
 */
export async function productionSheetToPdf(sheet: ProductionSheet, orgName: string, generatedAt: Date = new Date()): Promise<Buffer> {
  const logo = brand("logo-powered-by-shogun.png");
  const hasSupplier = sheet.toBuy.some((r) => r.supplier);
  return renderToBuffer(
    <Document title={`Ficha de produção · ${sheet.title}`} author="Precificaí · Grupo Shogun" subject={orgName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <Mark />
            <View>
              <Text style={s.org}>{orgName}</Text>
              <Text style={s.kicker}>Ficha de produção</Text>
            </View>
          </View>
          <Text style={s.date}>{dateBR(generatedAt)}</Text>
        </View>
        <View style={s.bar} />

        <Text style={s.title}>{sheet.title}</Text>
        <View style={s.chips}>
          <Text style={s.chip}>Para {productionDateLabel(sheet.plannedFor)}</Text>
          <Text style={s.chip}>{formatNumber(sheet.units, 0)} {sheet.units === 1 ? "marmita" : "marmitas"}</Text>
          {sheet.produced ? <Text style={s.chip}>Produção feita</Text> : null}
        </View>

        {sheet.products.length > 0 ? (
          <View wrap={false}>
            <Section title="Produzir" hint="Anote ao lado quanto saiu de verdade." />
            <View style={s.th}>
              <Text style={[s.thText, { flex: 1 }]}>Produto</Text>
              <Text style={[s.thText, s.right, { width: 70 }]}>Fazer</Text>
              <Text style={[s.thText, s.right, { width: 84 }]}>Saiu</Text>
            </View>
            {sheet.products.map((p, i) => (
              <View key={p.id} style={[s.row, i % 2 === 0 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
                <Text style={{ flex: 1 }}>{p.name}</Text>
                <Text style={[s.right, { width: 70, fontFamily: "Helvetica-Bold" }]}>{formatNumber(p.units, 0)}</Text>
                <View style={{ width: 84, alignItems: "flex-end" }}>
                  <View style={s.fill} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {sheet.receitas.length > 0 ? (
          <View>
            <Section title="Preparar" hint="Receitas em lote com a quantidade de cada insumo já somada para esta produção." />
            {sheet.receitas.map((r) => (
              <View key={r.id} style={s.receita} wrap={false}>
                <View style={s.receitaHead}>
                  <Text style={s.receitaName}>{r.name}</Text>
                  <Text style={s.receitaSub}>
                    {r.ready} prontos · {r.batches} (faça {r.wholeBatches} {r.wholeBatches === 1 ? "lote inteiro" : "lotes inteiros"})
                  </Text>
                </View>
                {r.ingredients.map((i, k) => (
                  <View key={`${i.name}-${k}`} style={[s.row, k % 2 === 1 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
                    <Text style={{ flex: 1 }}>{i.name}</Text>
                    <Text style={[s.right, { width: 90, fontFamily: "Helvetica-Bold" }]}>{i.qty}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {sheet.toBuy.length > 0 ? (
          <View wrap={false}>
            <Section title="Comprar" hint="Só o que falta, descontado o estoque. A quantidade vem em embalagens inteiras." />
            <View style={s.th}>
              <Text style={[s.thText, { flex: 1 }]}>Item</Text>
              {hasSupplier ? <Text style={[s.thText, { width: 110 }]}>Fornecedor</Text> : null}
              <Text style={[s.thText, s.right, { width: 120 }]}>Comprar</Text>
              <Text style={[s.thText, { width: 24, textAlign: "center" }]}>OK</Text>
            </View>
            {sheet.toBuy.map((r, i) => (
              <View key={r.id} style={[s.row, i % 2 === 0 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
                <Text style={{ flex: 1 }}>{r.name}</Text>
                {hasSupplier ? <Text style={{ width: 110, color: C.muted }}>{r.supplier ?? "—"}</Text> : null}
                <Text style={[s.right, { width: 120 }]}>{r.packs ?? r.buy}</Text>
                <View style={{ width: 24, alignItems: "center" }}>
                  <View style={s.box} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {sheet.skipped.length > 0 ? <Text style={s.warn}>Produtos com a ficha incompleta ficaram de fora da conta: {sheet.skipped.join(", ")}. Complete os itens deles para incluí-los.</Text> : null}

        <View wrap={false}>
          <Section title="Observações" />
          <View style={{ marginTop: 6 }}>
            {Array.from({ length: 4 }, (_, i) => (
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
