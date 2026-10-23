// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ME = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({ userId: ME })) }));

const state = vi.hoisted(() => ({
  profile: { is_platform_admin: false } as { is_platform_admin: boolean } | null,
  updates: [] as unknown[],
  authUpdates: [] as unknown[],
  authError: null as { message: string } | null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.profile }) }) }),
      update: (patch: unknown) => {
        state.updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
    auth: { admin: { updateUserById: async (_id: string, attrs: unknown) => (state.authUpdates.push(attrs), { error: state.authError }) } },
  }),
}));

import { changeUserEmail, setUserBlocked } from "./actions";

const form = (o: Record<string, string>) => Object.entries(o).reduce((f, [k, v]) => (f.set(k, v), f), new FormData());

beforeEach(() => {
  state.profile = { is_platform_admin: false };
  state.updates = [];
  state.authUpdates = [];
  state.authError = null;
});

describe("bloquear acesso", () => {
  it("não deixa o admin bloquear a si mesmo", async () => {
    const r = await setUserBlocked({}, form({ userId: ME, blocked: "1" }));
    expect(r.error).toMatch(/a si mesmo/);
    expect(state.authUpdates).toHaveLength(0);
  });

  it("não bloqueia outro admin Shogun", async () => {
    state.profile = { is_platform_admin: true };
    const r = await setUserBlocked({}, form({ userId: USER, blocked: "1" }));
    expect(r.error).toMatch(/admin/);
    expect(state.authUpdates).toHaveLength(0);
  });

  it("bloqueia: marca o perfil e bane no Auth", async () => {
    const r = await setUserBlocked({}, form({ userId: USER, blocked: "1" }));
    expect(r.ok).toMatch(/bloqueado/);
    expect((state.updates[0] as { blocked_at: string | null }).blocked_at).toBeTruthy();
    expect(state.authUpdates[0]).toEqual({ ban_duration: "876000h" });
  });

  it("libera: limpa a marca e tira o ban", async () => {
    const r = await setUserBlocked({}, form({ userId: USER, blocked: "0" }));
    expect(r.ok).toMatch(/liberado/);
    expect(state.updates[0]).toEqual({ blocked_at: null });
    expect(state.authUpdates[0]).toEqual({ ban_duration: "none" });
  });

  it("se o Auth falha, desfaz a marca do perfil", async () => {
    state.authError = { message: "boom" };
    const r = await setUserBlocked({}, form({ userId: USER, blocked: "1" }));
    expect(r.error).toBeTruthy();
    expect(state.updates).toHaveLength(2);
    expect(state.updates[1]).toEqual({ blocked_at: null });
  });
});

describe("trocar e-mail", () => {
  it("troca já confirmado e em minúsculas", async () => {
    const r = await changeUserEmail({}, form({ userId: USER, email: "Novo@Exemplo.com" }));
    expect(r.ok).toContain("novo@exemplo.com");
    expect(state.authUpdates[0]).toEqual({ email: "novo@exemplo.com", email_confirm: true });
  });

  it("e-mail que já tem conta dá aviso claro", async () => {
    state.authError = { message: "A user with this email address has already been registered" };
    const r = await changeUserEmail({}, form({ userId: USER, email: "outro@exemplo.com" }));
    expect(r.error).toBe("Esse e-mail já tem conta.");
  });

  it("e-mail inválido é recusado antes de chamar o Auth", async () => {
    const r = await changeUserEmail({}, form({ userId: USER, email: "nao-e-email" }));
    expect(r.error).toBeTruthy();
    expect(state.authUpdates).toHaveLength(0);
  });
});
