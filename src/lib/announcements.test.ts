import { describe, expect, it } from "vitest";
import { ANNOUNCEMENTS, ACTIVE_ANNOUNCEMENT_ID, DRAFT_ANNOUNCEMENT_ID, findAnnouncement, pickAnnouncement } from "./announcements";

describe("avisos de novidade", () => {
  it("o rascunho existe e fala de tudo que foi combinado, sem o Fechar o mês (a Produção ainda está travada)", () => {
    const draft = findAnnouncement(DRAFT_ANNOUNCEMENT_ID)!;
    const text = JSON.stringify(draft);
    for (const word of ["receitas", "Cardápio", "Ingredientes", "Financeiro", "Produção", "Lista de compras", "Estoque"]) expect(text).toContain(word);
    expect(text).not.toContain("fechar o mês");
  });

  it("o aviso no ar tem as duas atualizações em abas, a mais nova primeiro", () => {
    const live = findAnnouncement(ACTIVE_ANNOUNCEMENT_ID)!;
    expect(live.tabs?.map((t) => t.label)).toEqual(["03/11", "27/10"]);
    const text = JSON.stringify(live.tabs![0]);
    for (const word of ["Fichas técnicas", "Tabela nutricional", "Margem de segurança", "Meses anteriores", "fator de correção", "fator de cocção"]) expect(text).toContain(word);
    expect(text).not.toContain("fechar o mês");
    expect(JSON.stringify(live.tabs![1])).toContain("Agora você pode cadastrar receitas"); // o conteúdo de 27/10
  });

  it("ids são únicos", () => {
    expect(new Set(ANNOUNCEMENTS.map((a) => a.id)).size).toBe(ANNOUNCEMENTS.length);
  });

  it("com o aviso no ar, todos veem até marcarem a caixinha; depois nunca mais", () => {
    expect(ACTIVE_ANNOUNCEMENT_ID).toBe(DRAFT_ANNOUNCEMENT_ID);
    for (const previewAllowed of [false, true]) {
      const shown = pickAnnouncement({ dismissedIds: [], previewAllowed });
      expect(shown?.announcement.id).toBe(ACTIVE_ANNOUNCEMENT_ID);
      expect(shown?.preview).toBe(false); // vale de verdade, também para o admin (a dispensa é da conta dele)
      expect(pickAnnouncement({ dismissedIds: [ACTIVE_ANNOUNCEMENT_ID!], previewAllowed })).toBeNull();
    }
  });

  it("dispensar outro aviso não esconde este", () => {
    expect(pickAnnouncement({ dismissedIds: ["outro-aviso"], previewAllowed: false })?.announcement.id).toBe(ACTIVE_ANNOUNCEMENT_ID);
  });
});
