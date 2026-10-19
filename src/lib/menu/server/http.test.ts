// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AuthError, cardapiowebClient, TransientError } from "./http";

type Reply = { status: number; body?: unknown };

/** Troca o fetch: responde por trecho do caminho. */
function stubFetch(replies: Record<string, Reply>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      const key = Object.keys(replies).find((k) => url.pathname.includes(k));
      const r = key ? replies[key] : { status: 404 };
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const ERRO_500 = { status: 500, body: { code: 5000, message: "Erro interno do servidor." } };

describe("validar a chave do CardápioWeb", () => {
  it("a loja responde mesmo quando a lista de clientes dá 500: conecta", async () => {
    const calls = stubFetch({ "/merchant/customers": ERRO_500, "/merchant": { status: 200, body: { name: "Loja Teste" } } });
    await expect(cardapiowebClient("chave").ping()).resolves.toMatchObject({ name: "Loja Teste" });
    expect(calls[0]).toBe("/api/partner/v1/merchant"); // começa pelo teste leve
    expect(calls).not.toContain("/api/partner/v1/merchant/customers");
  });

  it("se os dados da loja falham, tenta os pedidos antes dos clientes", async () => {
    const calls = stubFetch({ "/orders/history": { status: 200, body: { orders: [] } }, "/merchant": ERRO_500 });
    await expect(cardapiowebClient("chave").ping()).resolves.toMatchObject({ orders: [] });
    expect(calls).toEqual(["/api/partner/v1/merchant", "/api/partner/v1/orders/history"]);
  });

  it("chave recusada (401) para na hora e não tenta o resto", async () => {
    const calls = stubFetch({ "/merchant": { status: 401 } });
    await expect(cardapiowebClient("errada").ping()).rejects.toBeInstanceOf(AuthError);
    expect(calls).toHaveLength(1);
  });

  it("erro 500 em tudo: falha passageira com o detalhe de cada teste (o erro é do lado deles)", async () => {
    stubFetch({ "/merchant": ERRO_500, "/orders/history": ERRO_500 });
    const err = await cardapiowebClient("chave").ping().catch((e) => e);
    expect(err).toBeInstanceOf(TransientError);
    expect(err.message).toContain("dados da loja: 500");
    expect(err.message).toContain("pedidos: 500");
    expect(err.message).toContain("clientes");
  });

  it("manda a chave de parceiro quando ela existe no ambiente", async () => {
    vi.stubEnv("CARDAPIOWEB_PARTNER_KEY", "parceiro");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: "X" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await cardapiowebClient("chave").ping();
    const headers = (fetchMock.mock.calls[0] as unknown as [unknown, { headers: Record<string, string> }])[1].headers;
    expect(headers["X-API-KEY"]).toBe("chave");
    vi.unstubAllEnvs();
  });
});
