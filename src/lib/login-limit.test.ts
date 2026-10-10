import { describe, expect, it } from "vitest";
import { LOGIN_LIMITS, clientIp, ipGroup, isOverLimit, loginKeys } from "./login-limit";

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

describe("IPv6 agrupado por /64", () => {
  it("endereços do mesmo bloco /64 contam juntos; IPv4 não muda", () => {
    expect(ipGroup("2804:14d:1234:5678:aaaa:bbbb:cccc:dddd")).toBe("2804:14d:1234:5678::/64");
    expect(ipGroup("2804:14d:1234:5678:1:2:3:4")).toBe("2804:14d:1234:5678::/64");
    expect(ipGroup("2804:14d:1234:5678::1")).toBe("2804:14d:1234:5678::/64");
    expect(ipGroup("200.1.2.3")).toBe("200.1.2.3");
    expect(ipGroup("desconhecido")).toBe("desconhecido");
    expect(loginKeys("2804:14d:1234:5678:aaaa::1", "a@b.com")).toEqual(loginKeys("2804:14d:1234:5678:bbbb::2", "a@b.com"));
    expect(loginKeys("2804:14d:1234:5679::1", "a@b.com").ip).not.toBe(loginKeys("2804:14d:1234:5678::1", "a@b.com").ip);
  });
});
