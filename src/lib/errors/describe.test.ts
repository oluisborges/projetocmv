import { describe, expect, it } from "vitest";
import { describeError, fingerprintKey, normalizeMessage, normalizePath, shouldIgnoreError } from "./describe";

describe("lendo o que foi lançado", () => {
  it("Error comum", () => {
    const e = new Error("falhou ao salvar");
    expect(describeError(e)).toMatchObject({ message: "falhou ao salvar", digest: null });
    expect(describeError(e).stack).toContain("falhou ao salvar");
  });
  it("digest do Next", () => {
    expect(describeError(Object.assign(new Error("x"), { digest: "123abc" })).digest).toBe("123abc");
  });
  it("texto, objeto e coisas estranhas nunca lançam", () => {
    expect(describeError("só texto").message).toBe("só texto");
    expect(describeError({ a: 1 }).message).toBe('{"a":1}');
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(describeError(circular).message).toBe("Erro desconhecido");
    expect(describeError(undefined).message).toBeTruthy();
  });
});

describe("o que não é erro de verdade", () => {
  it("redirecionamento e página não encontrada", () => {
    expect(shouldIgnoreError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }))).toBe(true);
    expect(shouldIgnoreError(Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }))).toBe(true);
    expect(shouldIgnoreError(new Error("NEXT_NOT_FOUND"))).toBe(true);
  });
  it("rede do usuário", () => {
    expect(shouldIgnoreError(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldIgnoreError(new Error("ResizeObserver loop completed"))).toBe(true);
  });
  it("erro de verdade é registrado", () => {
    expect(shouldIgnoreError(new Error("column foo does not exist"))).toBe(false);
  });
});

describe("agrupamento: erros iguais caem no mesmo tipo", () => {
  it("ignora ids, números e endereços na mensagem", () => {
    const a = normalizeMessage("pedido 8912345 não encontrado em https://x.com/a?b=1 (id 3f2a4c10-1111-2222-3333-444455556666)");
    const b = normalizeMessage("pedido 7766554 não encontrado em https://y.com/z (id aaaaaaaa-1111-2222-3333-444455556666)");
    expect(a).toBe(b);
    expect(a).toBe("pedido <n> não encontrado em <url> (id <id>)");
  });
  it("ignora o id na rota", () => {
    expect(normalizePath("/admin/uso/3f2a4c10-1111-2222-3333-444455556666?tipo=login")).toBe("/admin/uso/:id");
    expect(normalizePath("/fichas/123/editar")).toBe("/fichas/:n/editar");
    expect(normalizePath(null)).toBe("");
  });
  it("origens diferentes ou rotas diferentes são tipos diferentes", () => {
    expect(fingerprintKey("server", "boom", "/a")).not.toBe(fingerprintKey("client", "boom", "/a"));
    expect(fingerprintKey("server", "boom", "/a")).not.toBe(fingerprintKey("server", "boom", "/b"));
    expect(fingerprintKey("server", "boom 123456", "/a/1")).toBe(fingerprintKey("server", "boom 987654", "/a/2"));
  });
});
