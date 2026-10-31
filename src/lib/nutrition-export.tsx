import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { C, Mark, brand, dateBR } from "@/lib/ficha-tecnica-export";
import type { ProductNutrition } from "@/lib/nutrition-data";
import { nutritionRows } from "@/lib/nutrition-rows";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 70, paddingHorizontal: 38, fontFamily: "Helvetica", fontSize: 10, color: C.ink },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  org: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.deep },
  kicker: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 1.4, marginTop: 2 },
  date: { fontSize: 8, color: C.muted, textAlign: "right" },
  bar: { height: 3, backgroundColor: C.lime, marginTop: 10, borderRadius: 2 },
  title: { fontSize: 21, fontFamily: "Helvetica-Bold", color: C.deep, marginTop: 18, marginBottom: 14 },
  box: { borderWidth: 1.4, borderColor: "#000000", alignSelf: "center", width: 370, padding: 7 },
  boxTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#000000", paddingBottom: 3 },
  small: { fontSize: 9, paddingTop: 3, paddingBottom: 3, borderBottomWidth: 4, borderBottomColor: "#000000" },
  cols: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000000", paddingVertical: 3 },
  row: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: "#000000", paddingVertical: 3.5, alignItems: "center" },
  label: { flex: 1, fontSize: 9.5 },
  cell: { width: 86, textAlign: "right", fontSize: 9 },
  cellVd: { width: 34, textAlign: "right", fontSize: 9 },
  note: { fontSize: 8, color: C.muted, marginTop: 8, lineHeight: 1.4, alignSelf: "center", width: 370 },
  warn: { backgroundColor: C.amberBg, color: C.amber, fontSize: 8.5, padding: 8, borderRadius: 6, marginTop: 18, lineHeight: 1.4 },
  footer: { position: "absolute", left: 38, right: 38, bottom: 18, alignItems: "center" },
  footerLine: { height: 0.6, backgroundColor: C.line, alignSelf: "stretch", marginBottom: 8 },
  footerRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerSmall: { fontSize: 7.5, color: C.muted, width: 90 },
});

/** Tabela nutricional em PDF (A4): marca no topo, quadro no formato do rótulo (por 100 g, por porção e %VD) e o aviso de revisão. */
export async function nutritionToPdf(n: ProductNutrition, orgName: string, generatedAt: Date = new Date()): Promise<Buffer> {
  const logo = brand("logo-powered-by-shogun.png");
  const rows = nutritionRows(n.per100, n.perPortion);
  const portion = n.portionGrams ? `${n.portionGrams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g` : "—";
  return renderToBuffer(
    <Document title={`Tabela nutricional · ${n.name}`} author="Precificaí · Grupo Shogun" subject={orgName}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <Mark />
            <View>
              <Text style={s.org}>{orgName}</Text>
              <Text style={s.kicker}>Tabela nutricional</Text>
            </View>
          </View>
          <Text style={s.date}>{dateBR(generatedAt)}</Text>
        </View>
        <View style={s.bar} />
        <Text style={s.title}>{n.name}</Text>

        <View style={s.box}>
          <Text style={s.boxTitle}>INFORMAÇÃO NUTRICIONAL</Text>
          <Text style={s.small}>
            Porções por embalagem: 1{"\n"}Porção: {portion} ({n.householdMeasure})
          </Text>
          <View style={s.cols}>
            <Text style={s.label} />
            <Text style={[s.cell, { fontFamily: "Helvetica-Bold" }]}>100 g</Text>
            <Text style={[s.cell, { fontFamily: "Helvetica-Bold" }]}>{portion}</Text>
            <Text style={[s.cellVd, { fontFamily: "Helvetica-Bold" }]}>%VD*</Text>
          </View>
          {rows.map((r) => (
            <View key={r.key} style={s.row}>
              <Text style={[s.label, r.indent ? { paddingLeft: 10 } : { fontFamily: "Helvetica-Bold" }]}>{r.label}</Text>
              <Text style={s.cell}>{r.per100}</Text>
              <Text style={s.cell}>{r.perPortion}</Text>
              <Text style={s.cellVd}>{r.vd}</Text>
            </View>
          ))}
        </View>
        <Text style={s.note}>
          *Percentual de valores diários fornecidos pela porção, com base em uma dieta de 2.000 kcal ou 8.400 kJ. Seus valores diários podem ser maiores ou menores, dependendo de suas necessidades energéticas. **%VD não estabelecido.
        </Text>

        <Text style={s.warn}>
          Tabela gerada automaticamente a partir dos ingredientes do produto, com base na Tabela Brasileira de Composição de Alimentos (TACO, 4ª edição, NEPA/UNICAMP) e no formato da RDC 429/2020 e da IN 75/2020 da Anvisa. A revisão dos valores antes do uso no rótulo é responsabilidade da marmitaria.
          {n.override ? " Alguns valores foram ajustados manualmente." : ""}
        </Text>

        <View style={s.footer} fixed>
          <View style={s.footerLine} />
          <View style={s.footerRow}>
            <Text style={s.footerSmall}>{orgName}</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não é <img> */}
            {logo ? <Image src={{ data: logo, format: "png" }} style={{ width: 112, height: 32 }} /> : <Text style={{ fontSize: 9, color: C.teal }}>Precificaí · powered by Grupo Shogun</Text>}
            <Text style={[s.footerSmall, { textAlign: "right" }]} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>,
  );
}
