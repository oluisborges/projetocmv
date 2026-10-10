import { describe, expect, it } from "vitest";
import { LOGIN_LIMITS, clientIp, isOverLimit, loginKeys } from "./login-limit";

const headers = (init: Record<string, string>) => ({ get: (n: string) => init[n.toLowerCase()] ?? null });

describe("limite de tentativas de login", () => {
  it("bloqueia ao chegar no limite por conta ou por IP", () => {
    expect(isOverLimit({ account: LOGIN_LIMITS.perAccount - 1, ip: 0 })).toBe(false);
    expect(isOverLimit({ account: LOGIN_LIMITS.perAccount, ip: 0 })).toBe(true);
    expect(isOverLimit({ account: 0, ip: LOGIN_LIMITS.perIp - 1 })).toBe(false);
    expect(isOverLimit({ account: 0, ip: LOGIN_LIMITS.perIp })).toBe(true);
  });

  it("pega o primeiro IP do x-forwarded-for e cai para o x-real-ip", () => {
    expect(clientIp(headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(clientIp(headers({ "x-real-ip": "200.9.9.9" }))).toBe("200.9.9.9");
    expect(clientIp(headers({}))).toBe("desconhecido");
  });

  it("as chaves são hashes estáveis: mesmo IP+e-mail dá a mesma chave, e-mail com maiúscula não escapa do limite", () => {
    const a = loginKeys("200.1.2.3", "Dono@Marmita.com");
    const b = loginKeys("200.1.2.3", "dono@marmita.com ");
    expect(a).toEqual(b);
    expect(a.account).not.toContain("marmita");
    expect(a.ip).not.toContain("200.1.2.3");
    expect(loginKeys("200.1.2.4", "dono@marmita.com").account).not.toBe(a.account);
    expect(loginKeys("200.1.2.4", "outro@x.com").ip).toBe(loginKeys("200.1.2.4", "dono@marmita.com").ip);
  });
});
