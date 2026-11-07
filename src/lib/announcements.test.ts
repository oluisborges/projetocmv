import { describe, expect, it } from "vitest";
import { ANNOUNCEMENTS, ACTIVE_ANNOUNCEMENT_ID, DRAFT_ANNOUNCEMENT_ID, findAnnouncement, pickAnnouncement } from "./announcements";

describe("avisos de novidade", () => {
  it("o aviso de 07/11 fala de tudo o que mudou depois de 03/11, com a Produção liberada", () => {
    const draft = findAnnouncement(DRAFT_ANNOUNCEMENT_ID)!;
    const text = JSON.stringify(draft.tabs![0]);
    for (const word of ["Produção liberada", "Plano em 4 passos", "rendimento real", "estoque mínimo", "Lote e validade", "Movimentos", "Fechar o mês", "quanto pagou", "Compartilhar", "Baixar ficha de produção", "Ficha de montagem", "Ficha técnica", "Baixar Fichas", "CMV", "CMO", "Modo de preparo"]) {
      expect(text, word).toContain(word);
    }
    expect(text).not.toContain("cadeadinho");
    expect(text).not.toContain("Em breve");
  });

  it("o aviso no ar tem as duas atualizações em abas, a mais nova primeiro, e a de 27/10 saiu", () => {
    const live = findAnnouncement(ACTIVE_ANNOUNCEMENT_ID)!;
    expect(live.tabs?.map((t) => t.label)).toEqual(["07/11", "03/11"]);
    const old = JSON.stringify(live.tabs![1]);
    for (const word of ["Fichas técnicas", "Tabela nutricional", "Margem de segurança", "Meses anteriores", "fator de correção", "fator de cocção"]) expect(old).toContain(word);
    // nada de 27/10 nem da Produção "em breve" (agora ela está liberada)
    expect(JSON.stringify(live)).not.toContain("27/10");
    expect(JSON.stringify(live)).not.toContain("Agora você pode cadastrar receitas");
    expect(old).not.toContain("cadeadinho");
    // os nomes antigos das abas foram atualizados
    expect(old).toContain("Baixar Fichas");
    expect(old).not.toContain("Fichas Técnicas (e dentro");
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

  it("quem dispensou o aviso de 03/11 vê o de 07/11 (id novo)", () => {
    expect(pickAnnouncement({ dismissedIds: ["novidades-2026-11-03", "novidades-2026-10"], previewAllowed: false })?.announcement.id).toBe("novidades-2026-11-07");
  });

  it("dispensar outro aviso não esconde este", () => {
    expect(pickAnnouncement({ dismissedIds: ["outro-aviso"], previewAllowed: false })?.announcement.id).toBe(ACTIVE_ANNOUNCEMENT_ID);
  });
});
