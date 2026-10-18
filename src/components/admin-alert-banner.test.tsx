import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminAlertBanner } from "./admin-alert-banner";

const alert = (n: number, health: "error" | "late" = "error") => ({ connectionId: `c${n}`, orgId: "o", orgName: `Cliente ${n}`, health, text: `Cliente ${n} · CardápioWeb parou de importar` });

describe("aviso de cardápio parado para a equipe", () => {
  it("sem alerta não mostra nada", () => {
    expect(renderToStaticMarkup(<AdminAlertBanner alerts={[]} />)).toBe("");
  });

  it("um alerta: texto, e caminho para resolver", () => {
    const html = renderToStaticMarkup(<AdminAlertBanner alerts={[alert(1)]} />);
    expect(html).toContain("1 cardápio parou de importar");
    expect(html).toContain("Cliente 1 · CardápioWeb parou de importar");
    expect(html).toContain('href="/admin"');
  });

  it("vários: resume os três primeiros e conta o resto", () => {
    const html = renderToStaticMarkup(<AdminAlertBanner alerts={[alert(1), alert(2), alert(3), alert(4), alert(5)]} />);
    expect(html).toContain("5 cardápios pararam de importar");
    expect(html).toContain("e mais 2");
    expect(html).not.toContain("Cliente 4 ·");
  });
});
