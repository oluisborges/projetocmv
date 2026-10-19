import "server-only";
import { createHash } from "node:crypto";
import { apiDate, baseUrlOf, dataOf } from "../prefiro";
import type { CwOrderDetail } from "../cardapioweb";
import type { Raw } from "../types";

/** Chave recusada (401/403): a conexão vira "erro" até o Shogun conectar de novo. */
export class AuthError extends Error {}
/** Falha passageira (rede, 5xx, limite): tenta de novo no próximo ciclo. */
export class TransientError extends Error {}
/** A API recusou o intervalo pedido (400): encolhe a janela. */
export class RangeRefusedError extends Error {}

/** Nenhuma chamada ao provedor pode prender a função: passou disso, conta como falha passageira e tenta no próximo ciclo. */
const FETCH_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Espaça as chamadas para respeitar o limite do provedor. */
function gate(minGapMs: number) {
  let last = 0;
  return async () => {
    const wait = last + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
  };
}

const CW_BASE = process.env.CARDAPIOWEB_BASE_URL || "https://integracao.cardapioweb.com";

// ---------------------------------------------------------------- CardápioWeb

export function cardapiowebClient(apiKey: string) {
  const historyGate = gate(12_500); // histórico: 5 chamadas por minuto
  const detailGate = gate(650); // detalhe: 300 chamadas por 3 minutos
  const partnerKey = process.env.CARDAPIOWEB_PARTNER_KEY;

  async function get(path: string, params: Record<string, string | string[]>, g?: () => Promise<void>): Promise<Raw | null> {
    const url = new URL(`${CW_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) for (const x of Array.isArray(v) ? v : [v]) url.searchParams.append(k, x);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (g) await g();
      let res: Response;
      try {
        res = await fetch(url, { headers: { "X-API-KEY": apiKey, Accept: "application/json", ...(partnerKey ? { "X-PARTNER-KEY": partnerKey } : {}) }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      } catch (e) {
        throw new TransientError(`rede: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (res.status === 401 || res.status === 403) throw new AuthError("Chave recusada pelo CardápioWeb. Gere uma nova em Configurações → Integrações → API.");
      if (res.status === 429 && attempt === 0) {
        await sleep(Math.min(8_000, Number(res.headers.get("retry-after") ?? 15) * 1000));
        continue;
      }
      if (res.status === 404) return null;
      if (res.status === 400) throw new RangeRefusedError((await res.text()).slice(0, 300));
      if (!res.ok) throw new TransientError(`${res.status} ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    }
    throw new TransientError("limite de chamadas (429) persistente");
  }

  return {
    /** Pedidos fechados do intervalo (só o resumo: id, datas). */
    history: (start: string, end: string, page: number): Promise<{ orders?: { id: number }[]; pagination?: { total_pages?: number } } | null> =>
      get("/api/partner/v1/orders/history", { start_date: start, end_date: end, "status[]": ["closed"], page: String(page), per_page: "100" }, historyGate),
    detail: async (id: string) => (await get(`/api/partner/v1/orders/${encodeURIComponent(id)}`, {}, detailGate)) as CwOrderDetail | null,
    merchant: (): Promise<{ name?: string } | null> => get("/api/partner/v1/merchant", {}).catch(() => null),
    /**
     * Valida a chave. A API não tem um "teste de chave", e a lista de clientes (que usávamos) devolve 500 em algumas lojas:
     * tenta os dados da loja, depois os pedidos de um dia e só por último os clientes. Qualquer resposta com conteúdo prova que a chave vale.
     * Chave recusada (401/403) para na hora; se TODAS falharem por erro do servidor, o erro é do CardápioWeb e a mensagem diz isso.
     */
    ping: async (): Promise<Raw> => {
      const day = new Date();
      const attempts: [string, () => Promise<Raw | null>][] = [
        ["dados da loja", () => get("/api/partner/v1/merchant", {})],
        ["pedidos", () => get("/api/partner/v1/orders/history", { start_date: new Date(day.getTime() - 86_400_000).toISOString(), end_date: day.toISOString(), "status[]": ["closed"], page: "1", per_page: "1" }, historyGate)],
        ["clientes", () => get("/api/partner/v1/merchant/customers", { page: "1", per_page: "1" })],
      ];
      const failures: string[] = [];
      for (const [label, run] of attempts) {
        try {
          const r = await run();
          if (r) return r;
          failures.push(`${label}: sem resposta (404)`);
        } catch (e) {
          if (e instanceof AuthError) throw e;
          failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new TransientError(failures.join(" | "));
    },
  };
}
export type CardapiowebClient = ReturnType<typeof cardapiowebClient>;

// ---------------------------------------------------------------- Prefiro

// A documentação diz base64(md5(HASH|CHAVE)) sem dizer se o md5 é texto hexadecimal ou bytes. O mais comum é o hexadecimal;
// se a Prefiro recusar, tentamos os bytes.
const prefiroTokens = (hash: string, apiKey: string) => {
  const md5 = createHash("md5").update(`${hash}|${apiKey}`);
  return [Buffer.from(md5.copy().digest("hex")).toString("base64"), md5.digest("base64")];
};

export function prefiroClient(hash: string, apiKey: string) {
  const base = baseUrlOf(hash);
  const auths = prefiroTokens(hash, apiKey).map((t) => `Basic ${t}`);
  const pace = gate(250);
  let authIx = 0;

  type Reply = { status: number; ok: boolean; body: Raw | null; raw: string };

  async function get(path: string, params: Record<string, string> = {}): Promise<Reply> {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    let waited = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      await pace();
      let res: Response;
      try {
        res = await fetch(url, { headers: { Authorization: auths[authIx], Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      } catch (e) {
        throw new TransientError(`rede: ${e instanceof Error ? e.message : String(e)}`);
      }
      if ((res.status === 401 || res.status === 403) && authIx < auths.length - 1) {
        authIx++;
        attempt--;
        continue;
      }
      if (res.status === 401 || res.status === 403) throw new AuthError("A Prefiro recusou a hash e a chave de API. Confira se copiou os dois sem espaços.");
      if (res.status === 429 && !waited) {
        waited = true;
        await sleep(Math.min(8_000, Number(res.headers.get("retry-after") ?? 10) * 1000));
        continue;
      }
      if (res.status >= 500) throw new TransientError(`HTTP ${res.status}`);
      const raw = await res.text();
      let body: Raw | null = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // resposta que não é JSON: fica só o texto
      }
      if (body && (String(body.codigo) === "401" || String(body.codigo) === "403")) throw new AuthError("A Prefiro recusou a hash e a chave de API.");
      const ok = res.ok && !(body && body.codigo !== undefined && !/^2/.test(String(body.codigo)));
      return { status: res.status, ok, body, raw: raw.slice(0, 300) };
    }
    throw new TransientError("limite de chamadas persistente");
  }

  return {
    ping: async () => {
      const r = await get("/estabelecimentos");
      return { ok: r.ok, status: r.status, raw: r.raw, name: (dataOf(r.body)[0]?.nome as string | undefined) ?? null };
    },
    /** Pedidos (já com itens) criados ou alterados no intervalo. Não lança em 4xx: quem chama decide. */
    orders: async (from: Date, to: Date, by: "created" | "updated" = "created") => {
      const r = await get("/pedidos", { [`${by}_at_gte`]: apiDate(from), [`${by}_at_lte`]: apiDate(to) });
      return { ok: r.ok, status: r.status, raw: r.raw, data: dataOf(r.body) };
    },
    recent: async () => {
      const r = await get("/pedidos");
      return { ok: r.ok, status: r.status, raw: r.raw, data: dataOf(r.body) };
    },
    detail: async (id: string) => {
      const r = await get(`/pedido/${encodeURIComponent(id)}`);
      if (r.status === 404) return null;
      if (!r.ok) throw new TransientError(`HTTP ${r.status}: ${r.raw}`);
      return dataOf(r.body)[0] ?? null;
    },
  };
}
export type PrefiroClient = ReturnType<typeof prefiroClient>;
