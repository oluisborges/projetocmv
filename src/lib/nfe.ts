// Nota fiscal eletrônica (NF-e, arquivo XML): leitura e conta do preço de cada item. Regras puras (sem banco, sem rede).
import { XMLParser } from "fast-xml-parser";
import { normalizeName } from "@/lib/names";
import { normalizeUnit, type NfeItem } from "./nfe-price";

export type NfeDoc = {
  /** Chave de acesso (44 dígitos): identifica a nota, impede importar duas vezes. */
  accessKey: string;
  number: string | null;
  supplierCnpj: string;
  supplierName: string;
  /** Data de emissão, ISO com fuso. */
  issuedAt: string;
  total: number;
  items: NfeItem[];
};

export type NfeParse = { ok: true; doc: NfeDoc } | { ok: false; error: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false, // tudo texto: a conversão é nossa (vírgula/ponto, zeros à esquerda do CNPJ)
  processEntities: false, // sem resolver entidades externas (XML malicioso)
  isArray: (name) => name === "det",
});

type Node = Record<string, unknown>;
const asNode = (v: unknown): Node => (v && typeof v === "object" ? (v as Node) : {});
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const dec = (v: unknown): number => {
  const n = Number(str(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function issuedAtOf(ide: Node): string | null {
  const raw = str(ide.dhEmi) || str(ide.dEmi);
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:?\d{2})?)?/);
  if (!m) return null;
  const iso = `${m[1]}T${m[2] ? (m[2].length === 5 ? `${m[2]}:00` : m[2]) : "12:00:00"}${m[3] ?? "-03:00"}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Lê o XML de uma NF-e (com ou sem o envelope nfeProc). Nunca lança. */
export function parseNfeXml(xml: string): NfeParse {
  let root: Node;
  try {
    root = asNode(parser.parse(xml));
  } catch {
    return { ok: false, error: "O arquivo não é um XML válido." };
  }
  const nfe = asNode(asNode(root.nfeProc).NFe ?? root.NFe);
  const inf = asNode(nfe.infNFe);
  if (Object.keys(inf).length === 0) return { ok: false, error: "Este XML não é uma nota fiscal eletrônica (NF-e)." };

  const accessKey = (str(inf["@_Id"]).replace(/\D/g, "") || str(asNode(asNode(asNode(root.nfeProc).protNFe).infProt).chNFe)).slice(0, 44);
  if (accessKey.length !== 44) return { ok: false, error: "Não encontrei a chave de acesso (44 dígitos) da nota." };

  const ide = asNode(inf.ide);
  const issuedAt = issuedAtOf(ide);
  if (!issuedAt) return { ok: false, error: "Não encontrei a data de emissão da nota." };

  const emit = asNode(inf.emit);
  const dets = Array.isArray(inf.det) ? (inf.det as unknown[]) : [];
  const items: NfeItem[] = dets.flatMap((d, i) => {
    const det = asNode(d);
    const prod = asNode(det.prod);
    const qty = dec(prod.qCom);
    const name = str(prod.xProd);
    if (!name || qty <= 0) return [];
    const total = Math.max(0, dec(prod.vProd) - dec(prod.vDesc));
    return [
      {
        index: Number(str(det["@_nItem"])) || i + 1,
        code: str(prod.cProd) || normalizeName(name).slice(0, 40),
        name,
        unit: normalizeUnit(str(prod.uCom)),
        qty,
        unitPrice: dec(prod.vUnCom),
        total: Math.round(total * 100) / 100,
      },
    ];
  });
  if (items.length === 0) return { ok: false, error: "A nota não tem itens." };

  return {
    ok: true,
    doc: {
      accessKey,
      number: str(ide.nNF) || null,
      supplierCnpj: str(emit.CNPJ).replace(/\D/g, "") || str(emit.CPF).replace(/\D/g, ""),
      supplierName: str(emit.xNome) || "Fornecedor",
      issuedAt,
      total: dec(asNode(asNode(inf.total).ICMSTot).vNF),
      items,
    },
  };
}


export * from "./nfe-price";
