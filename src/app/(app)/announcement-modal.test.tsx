import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ANNOUNCEMENTS } from "@/lib/announcements";
import { AnnouncementModal } from "./announcement-modal";

vi.mock("./actions", () => ({ dismissAnnouncement: vi.fn() }));

describe("modal de novidades", () => {
  const html = renderToStaticMarkup(<AnnouncementModal announcement={ANNOUNCEMENTS[0]} preview={false} />);

  it("tem o X no canto e a caixinha de não mostrar mais", () => {
    expect(html).toContain('aria-label="Fechar aviso"');
    expect(html).toContain("Entendi, não precisa mais mostrar este aviso");
    expect(html).toContain('type="checkbox"');
  });

  it("aviso com abas: abre na atualização mais nova (07/11) e mostra as duas abas", () => {
    const tabbed = ANNOUNCEMENTS.find((a) => a.tabs)!;
    const out = renderToStaticMarkup(<AnnouncementModal announcement={tabbed} preview={false} />);
    expect(out).toContain('role="tablist"');
    expect(out).toContain("07/11");
    expect(out).toContain("03/11");
    expect(out).not.toContain("27/10");
    expect(out).toContain("Atualização de 07/11");
    expect(out).toContain("Produção liberada");
    expect(out).not.toContain("Tabela nutricional automática"); // é da aba 03/11, que só aparece ao tocar nela
  });

  it("mostra o título e a Produção liberada, sem cadeado nem 'em breve'", () => {
    expect(html).toContain("Novidades do Precificaí");
    expect(html).toContain("Produção liberada");
    expect(html).not.toContain("cadeadinho");
    expect(html).not.toContain("Em breve");
  });
});
