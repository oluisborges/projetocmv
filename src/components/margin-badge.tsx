import type { MarginStatus } from "@/lib/calc";
import { formatPct } from "@/lib/format";

const STYLE: Record<MarginStatus, { label: string; className: string }> = {
  good: { label: "Lucro bom", className: "bg-success/10 text-success" },
  warning: { label: "Lucro apertado", className: "bg-warning/10 text-warning" },
  "below-target": { label: "Abaixo da meta", className: "bg-danger/10 text-danger" },
};

/**
 * Semáforo do lucro (margem líquida). Cor + texto: não depende só da cor (daltonismo, sol na tela).
 * `estimate`: impostos e despesas ainda não foram informados, então NÃO dá veredito: só mostra o número como estimativa.
 */
export function MarginBadge({ status, pct, estimate = false }: { status: MarginStatus; pct: number; estimate?: boolean }) {
  const s = estimate ? { label: "Estimativa", className: "bg-foreground/10 text-foreground" } : STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      {s.label} · {formatPct(pct)}
    </span>
  );
}
