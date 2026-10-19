// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ value: null as unknown }));
const active = vi.hoisted(() => ({ value: null as unknown }));
const notices = vi.hoisted(() => vi.fn(async () => [{}, {}, {}]));

vi.mock("@/lib/auth", () => ({ getSession: async () => session.value, getActiveOrg: async () => active.value }));
vi.mock("@/lib/notices-data", () => ({ loadNotices: notices }));

import { GET } from "./route";

describe("GET /api/avisos/count", () => {
  beforeEach(() => {
    session.value = { userId: "u1", mustChangePassword: false };
    active.value = { orgId: "org-1", canWrite: true, viewingAs: false };
    notices.mockClear();
  });

  it("sem sessão: 401 e nada é calculado", async () => {
    session.value = null;
    const res = await GET();
    expect(res.status).toBe(401);
    expect(notices).not.toHaveBeenCalled();
  });

  it("com senha provisória: 401 (nada abre antes de trocar a senha)", async () => {
    session.value = { userId: "u1", mustChangePassword: true };
    expect((await GET()).status).toBe(401);
    expect(notices).not.toHaveBeenCalled();
  });

  it("sem marmitaria ativa: 401", async () => {
    active.value = null;
    expect((await GET()).status).toBe(401);
  });

  it("devolve a contagem da marmitaria ativa, só leitura e sem cache do navegador", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 3 });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(notices).toHaveBeenCalledWith("org-1", false);
  });
});
