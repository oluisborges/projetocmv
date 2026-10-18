import type { EngineeringResult, Quadrant } from "@/lib/menu-engineering";

const FILL: Record<Quadrant, string> = { star: "fill-success", plowhorse: "fill-warning", puzzle: "fill-primary", dog: "fill-danger" };

const W = 340;
const H = 250;
const PAD = { l: 8, r: 8, t: 14, b: 22 };

/**
 * Mapa das marmitas: quanto vende (para a direita) × quanto sobra em cada uma (para cima). O tamanho da bolha é o lucro total.
 * As linhas tracejadas são o corte de popularidade e a sobra média: o encontro delas define os quatro grupos.
 */
export function MenuMatrix({ result }: { result: EngineeringResult }) {
  const items = result.products;
  if (items.length === 0) return null;

  const maxShare = Math.max(result.popularityCut * 2, ...items.map((p) => p.unitShare)) * 1.1;
  const ys = items.map((p) => p.unitContribution);
  const minY = Math.min(0, ...ys, result.avgUnitContribution) * 1.1;
  const maxY = Math.max(...ys, result.avgUnitContribution) * 1.1 || 1;
  const maxTotal = Math.max(...items.map((p) => Math.max(0, p.totalContribution)), 1);

  const x = (v: number) => PAD.l + (v / maxShare) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - minY) / (maxY - minY)) * (H - PAD.t - PAD.b);
  const cutX = x(result.popularityCut);
  const cutY = y(result.avgUnitContribution);
  const top = new Set(items.slice(0, 4).map((p) => p.id)); // os que mais dão lucro ganham nome no gráfico

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa das marmitas: vendas por lucro de cada uma" className="w-full rounded-xl bg-background">
        <line x1={cutX} y1={PAD.t} x2={cutX} y2={H - PAD.b} className="stroke-border" strokeDasharray="4 3" />
        <line x1={PAD.l} y1={cutY} x2={W - PAD.r} y2={cutY} className="stroke-border" strokeDasharray="4 3" />
        <text x={W - PAD.r - 2} y={PAD.t + 9} textAnchor="end" className="fill-muted text-[9px] font-semibold">
          ESTRELAS
        </text>
        <text x={W - PAD.r - 2} y={H - PAD.b - 4} textAnchor="end" className="fill-muted text-[9px] font-semibold">
          VENDEM BEM, SOBRA POUCO
        </text>
        <text x={PAD.l + 2} y={PAD.t + 9} className="fill-muted text-[9px] font-semibold">
          JOIAS ESCONDIDAS
        </text>
        <text x={PAD.l + 2} y={H - PAD.b - 4} className="fill-muted text-[9px] font-semibold">
          POUCO RETORNO
        </text>
        {items.map((p) => {
          const r = 4 + Math.sqrt(Math.max(0, p.totalContribution) / maxTotal) * 11;
          const cx = x(p.unitShare);
          const cy = y(p.unitContribution);
          return (
            <g key={p.id}>
              <circle cx={cx} cy={cy} r={r} className={`${FILL[p.quadrant]} opacity-70`} />
              {top.has(p.id) ? (
                <text x={cx} y={cy - r - 2} textAnchor={cx > W - 70 ? "end" : cx < 70 ? "start" : "middle"} className="fill-foreground text-[9px] font-semibold">
                  {p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-muted text-[9px]">
          vende mais →
        </text>
      </svg>
      <figcaption className="text-xs text-muted">Quanto mais à direita, mais vende; quanto mais acima, mais sobra em cada marmita. Bolha grande = muito lucro no total.</figcaption>
    </figure>
  );
}
