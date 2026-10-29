import { describe, expect, it } from "vitest";
import { ANNOUNCEMENTS, ACTIVE_ANNOUNCEMENT_ID, DRAFT_ANNOUNCEMENT_ID, findAnnouncement, pickAnnouncement } from "./announcements";

describe("avisos de novidade", () => {
  it("o rascunho existe e fala de tudo que foi combinado, sem o Fechar o mês (a Produção ainda está travada)", () => {
    const draft = findAnnouncement(DRAFT_ANNOUNCEMENT_ID)!;
    const text = JSON.stringify(draft);
    for (const word of ["receitas", "Cardápio", "Ingredientes", "Financeiro", "Produção", "lista de compras", "estoque"]) expect(text).toContain(word);
    expect(text).not.toContain("fechar o mês");
  });

  it("ids são únicos", () => {
    expect(new Set(ANNOUNCEMENTS.map((a) => a.id)).size).toBe(ANNOUNCEMENTS.length);
  });

  it("enquanto nenhum aviso está no ar, cliente não vê nada e só o admin enxerga o rascunho (prévia)", () => {
    expect(ACTIVE_ANNOUNCEMENT_ID).toBeNull();
    expect(pickAnnouncement({ dismissedIds: [], previewAllowed: false })).toBeNull();
    const admin = pickAnnouncement({ dismissedIds: [], previewAllowed: true });
    expect(admin?.preview).toBe(true);
    expect(admin?.announcement.id).toBe(DRAFT_ANNOUNCEMENT_ID);
  });
});
