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

  it("mostra o título, as novidades e a Produção em breve", () => {
    expect(html).toContain("O Precificaí ficou mais fácil de usar");
    expect(html).toContain("Agora você pode cadastrar receitas");
    expect(html).toContain("Vem aí: Produção");
    expect(html).toContain("cadeadinho");
  });
});
