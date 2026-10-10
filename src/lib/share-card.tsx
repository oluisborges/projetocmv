import { ImageResponse } from "next/og";
import { formatBRL, formatPct } from "@/lib/format";
import type { PanelSummary } from "@/lib/panel-view";

const GREEN = "#1C3B33";
const MUTED = "#5b6360";

/** Cartão para compartilhar: só percentuais (nada de faturamento), com a marca do Grupo Shogun. */
export function shareCardImage(input: { orgName: string; month: string; composition: PanelSummary["composition"]; configured: boolean; logo: string | null }) {
  const { orgName, month, logo, configured } = input;
  const c = input.composition;
  const parts = [
    { label: "Ingredientes e embalagem", pct: c.cmv, color: GREEN },
    { label: "Equipe", pct: c.cmo, color: "#4d7c6f" },
    { label: "Despesas fixas", pct: c.fixed, color: "#a3a8a6" },
    { label: "Impostos e taxas", pct: c.commercial, color: "#b45309" },
    { label: "Lucro líquido", pct: c.profit, color: "#16a34a" },
  ];
  const total = parts.filter((p) => p.pct > 0).reduce((s, p) => s + p.pct, 0) || 1;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#f5f7f3", padding: 56, fontFamily: "sans-serif" }}>
        {/* faixa de cor da marca */}
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, height: 14, background: GREEN }} />
        <div style={{ display: "flex", position: "absolute", top: 14, left: 0, width: 360, height: 6, background: "#9ACD3A" }} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} width={230} height={147} alt="" style={{ marginTop: 14, objectFit: "contain" }} /> : null}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 18 }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, color: GREEN, textAlign: "center" }}>{orgName}</div>
          <div style={{ display: "flex", fontSize: 28, color: MUTED, marginTop: 6 }}>Meu negócio em {month}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "white", borderRadius: 40, padding: "40px 48px", marginTop: 34, width: "100%", boxShadow: "0 8px 40px rgba(28,59,51,0.12)" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: MUTED, letterSpacing: 2 }}>LUCRO LÍQUIDO MÉDIO</div>
          <div style={{ display: "flex", fontSize: 190, fontWeight: 900, color: GREEN, lineHeight: 1.05 }}>{formatPct(c.profit)}</div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
            Em cada R$ 100 vendidos, sobram {formatBRL(c.profit * 100)}
          </div>

          <div style={{ display: "flex", width: "100%", height: 34, borderRadius: 17, overflow: "hidden", marginTop: 36, background: "#e5e7e3" }}>
            {parts
              .filter((p) => p.pct > 0)
              .map((p) => (
                <div key={p.label} style={{ display: "flex", height: "100%", width: `${(p.pct / total) * 100}%`, background: p.color }} />
              ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: "100%", marginTop: 26 }}>
            {parts.map((p) => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", width: 26, height: 26, borderRadius: 13, background: p.color, marginRight: 16 }} />
                  <div style={{ display: "flex", fontSize: 30, color: "#1f2937" }}>{p.label}</div>
                </div>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 800, color: GREEN }}>{formatPct(p.pct)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 800, color: GREEN }}>Calculado com Shogun Precificação</div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{configured ? "Custo, margem e preço certo do que você vende" : "Estimativa: faltam impostos e despesas"}</div>
          </div>
          <div style={{ display: "flex", background: GREEN, color: "white", fontSize: 26, fontWeight: 800, padding: "12px 26px", borderRadius: 999 }}>Grupo Shogun</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 },
  );
}
