import { describe, expect, it } from "vitest";
import { classifyUnit, newPurchasePrice, nfeCostPerBase, normalizeUnit, parseNfeXml, suggestIngredient } from "./nfe";

const KEY = "35261012345678000190550010000123451234567890";

/** Nota de açougue/hortifruti como o fornecedor entrega (com envelope e namespace). */
const nota = (inf: string, envelope = true) =>
  envelope
    ? `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${KEY}" versao="4.00">${inf}</infNFe></NFe><protNFe><infProt><chNFe>${KEY}</chNFe></infProt></protNFe></nfeProc>`
    : `<?xml version="1.0"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${KEY}">${inf}</infNFe></NFe>`;

const header = `<ide><nNF>12345</nNF><dhEmi>2026-10-12T10:20:30-03:00</dhEmi></ide><emit><CNPJ>12345678000190</CNPJ><xNome>Frigorífico Boi Bom Ltda</xNome></emit>`;
const det = (n: number, code: string, name: string, unit: string, qty: string, unitPrice: string, total: string, desc?: string) =>
  `<det nItem="${n}"><prod><cProd>${code}</cProd><xProd>${name}</xProd><uCom>${unit}</uCom><qCom>${qty}</qCom><vUnCom>${unitPrice}</vUnCom><vProd>${total}</vProd>${desc ? `<vDesc>${desc}</vDesc>` : ""}</prod></det>`;

const xml = nota(
  `${header}${det(1, "A100", "FILE DE PEITO DE FRANGO CONGELADO", "KG", "50.0000", "17.9000", "895.00")}${det(2, "B200", "OVOS BRANCOS BANDEJA 30", "CX", "4.0000", "180.0000", "720.00", "20.00")}<total><ICMSTot><vNF>1595.00</vNF></ICMSTot></total>`,
);

describe("leitura da NF-e", () => {
  it("lê fornecedor, data, chave, total e itens", () => {
    const r = parseNfeXml(xml);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc).toMatchObject({ accessKey: KEY, number: "12345", supplierCnpj: "12345678000190", supplierName: "Frigorífico Boi Bom Ltda", total: 1595 });
    expect(r.doc.issuedAt).toBe("2026-10-12T13:20:30.000Z");
    expect(r.doc.items).toHaveLength(2);
    expect(r.doc.items[0]).toEqual({ index: 1, code: "A100", name: "FILE DE PEITO DE FRANGO CONGELADO", unit: "KG", qty: 50, unitPrice: 17.9, total: 895 });
  });

  it("o desconto do item entra no valor", () => {
    const r = parseNfeXml(xml);
    if (!r.ok) throw new Error("falhou");
    expect(r.doc.items[1].total).toBe(700); // 720 − 20
  });

  it("nota com um item só (o XML não vira lista) e sem envelope", () => {
    const r = parseNfeXml(nota(`${header}${det(1, "C1", "ARROZ BRANCO", "KG", "10", "5.5", "55.00")}`, false));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.items).toHaveLength(1);
  });

  it("data só com dia (dEmi) e preço com vírgula", () => {
    const r = parseNfeXml(nota(`<ide><nNF>9</nNF><dEmi>2026-10-05</dEmi></ide><emit><CNPJ>1</CNPJ><xNome>X</xNome></emit>${det(1, "C", "FEIJAO", "KG", "5,5", "7,2", "39,60")}`));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc.issuedAt.startsWith("2026-10-05")).toBe(true);
      expect(r.doc.items[0]).toMatchObject({ qty: 5.5, unitPrice: 7.2, total: 39.6 });
    }
  });

  it("recusa o que não é nota, XML quebrado e nota sem itens", () => {
    expect(parseNfeXml("isto não é xml <<<").ok).toBe(false);
    expect(parseNfeXml("<outra><coisa/></outra>")).toEqual({ ok: false, error: "Este XML não é uma nota fiscal eletrônica (NF-e)." });
    expect(parseNfeXml(nota(`${header}<total><ICMSTot><vNF>0</vNF></ICMSTot></total>`)).ok).toBe(false);
  });

  it("não resolve entidades externas (XML malicioso)", () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>` + nota(`${header}${det(1, "C", "&e;", "KG", "1", "1", "1")}`, false).replace(/^<\?xml[^>]*>/, "");
    const r = parseNfeXml(evil);
    if (r.ok) expect(r.doc.items[0]?.name ?? "").not.toContain("root:");
  });
});

describe("unidades e preço", () => {
  it("normaliza a unidade", () => {
    expect(normalizeUnit("Pç.")).toBe("PC");
    expect(normalizeUnit("kg")).toBe("KG");
    expect(normalizeUnit(" Un ")).toBe("UN");
  });

  it("peso/volume/contagem medem; o resto é embalagem", () => {
    expect(classifyUnit("KG")).toEqual({ kind: "measure", unit: "kg" });
    expect(classifyUnit("LT")).toEqual({ kind: "measure", unit: "l" });
    expect(classifyUnit("UND")).toEqual({ kind: "measure", unit: "un" });
    expect(classifyUnit("CX")).toEqual({ kind: "pack" });
    expect(classifyUnit("PCT")).toEqual({ kind: "pack" });
  });

  it("frango a R$ 17,90 o kg custa R$ 0,0179 por grama", () => {
    const c = nfeCostPerBase({ unit: "KG", qty: 50, unitPrice: 17.9, total: 895 })!;
    expect(c.base).toBe("g");
    expect(c.perBase).toBeCloseTo(0.0179, 6);
  });

  it("usa o valor depois do desconto da nota", () => {
    // 4 caixas por 700 (já com desconto): 175 a caixa, de 30 ovos => 5,8333 por ovo
    const c = nfeCostPerBase({ unit: "CX", qty: 4, unitPrice: 180, total: 700 }, { qty: 30, unit: "un" })!;
    expect(c.base).toBe("un");
    expect(c.perBase).toBeCloseTo(175 / 30, 6);
  });

  it("embalagem sem conteúdo informado não tem como calcular", () => {
    expect(nfeCostPerBase({ unit: "CX", qty: 4, unitPrice: 180, total: 720 })).toBeNull();
    expect(nfeCostPerBase({ unit: "CX", qty: 4, unitPrice: 180, total: 720 }, { qty: 0, unit: "un" })).toBeNull();
  });

  it("saco de 5 kg: preço do saco ÷ 5.000 g", () => {
    const c = nfeCostPerBase({ unit: "SC", qty: 2, unitPrice: 28, total: 56 }, { qty: 5, unit: "kg" })!;
    expect(c.base).toBe("g");
    expect(c.perBase).toBeCloseTo(28 / 5000, 8);
  });

  it("novo preço de compra mantém a embalagem do insumo", () => {
    // insumo comprado em 2 kg: 0,0179 × 2000 = 35,80
    expect(newPurchasePrice({ base: "g", perBase: 0.0179 }, { purchase_qty: 2, purchase_unit: "kg" })).toBe(35.8);
    // insumo por unidade (bandeja de 30 ovos, cadastrada como 30 un): 5,8333 × 30 = 175
    expect(newPurchasePrice({ base: "un", perBase: 175 / 30 }, { purchase_qty: 30, purchase_unit: "un" })).toBe(175);
  });

  it("nota em litros para um insumo em gramas é incompatível", () => {
    expect(newPurchasePrice({ base: "ml", perBase: 0.005 }, { purchase_qty: 1, purchase_unit: "kg" })).toBeNull();
  });
});

describe("ligar o item da nota ao insumo", () => {
  const insumos = [
    { id: "1", name: "Peito de frango" },
    { id: "2", name: "Arroz branco" },
    { id: "3", name: "Ovos" },
    { id: "4", name: "Óleo de soja" },
  ];

  it("acha pelo nome, ignorando peso, unidade e palavras de ligação", () => {
    expect(suggestIngredient("FILE DE PEITO DE FRANGO CONGELADO KG", insumos)?.id).toBe("1");
    expect(suggestIngredient("ARROZ BRANCO TIPO 1 5KG", insumos)?.id).toBe("2");
    expect(suggestIngredient("OVOS BRANCOS BANDEJA 30", insumos)?.id).toBe("3");
  });

  it("não chuta quando não parece com nada", () => {
    expect(suggestIngredient("DETERGENTE NEUTRO 500ML", insumos)).toBeNull();
    expect(suggestIngredient("", insumos)).toBeNull();
  });

  it("não escolhe quando dois insumos empatam", () => {
    const twin = [
      { id: "a", name: "Frango" },
      { id: "b", name: "Frango" },
    ];
    expect(suggestIngredient("FRANGO INTEIRO", twin)).toBeNull();
  });

  it("exige todas as palavras do insumo no item (óleo de soja ≠ óleo de girassol)", () => {
    expect(suggestIngredient("OLEO DE GIRASSOL 900ML", insumos)).toBeNull();
    expect(suggestIngredient("OLEO DE SOJA 900ML", insumos)?.id).toBe("4");
  });
});
