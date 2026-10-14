import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shareCardImage } from "./share-card";

describe("cartão de compartilhar", () => {
  it("gera uma imagem PNG 1080×1350 com os dados", async () => {
    const logo = `data:image/png;base64,${readFileSync("public/brand/logo-powered-by-shogun.png").toString("base64")}`;
    const res = shareCardImage({
      orgName: "Marmitaria da Ação & Café",
      month: "outubro de 2026",
      composition: { cmv: 0.38, cmo: 0.1, fixed: 0.12, commercial: 0.11, profit: 0.29 },
      configured: true,
      logo,
    });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (process.env.SHARE_CARD_OUT) writeFileSync(process.env.SHARE_CARD_OUT, bytes); // para olhar o resultado
    expect([...bytes.slice(1, 4)]).toEqual([80, 78, 71]); // "PNG"
    expect(bytes.length).toBeGreaterThan(10_000);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(16)).toBe(1080);
    expect(view.getUint32(20)).toBe(1350);
  }, 60_000);
});
