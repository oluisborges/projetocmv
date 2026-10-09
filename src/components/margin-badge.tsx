import type { MarginStatus } from "@/lib/calc";
import { formatPct } from "@/lib/format";

const STYLE: Record<MarginStatus, { label: string; className: string }> = {
  good: { label: "Margem boa", className: "bg-success/10 text-success" },
  warning: { label: "Margem apertada", className: "bg-warning/10 text-warning" },
  "below-target": { label: "Abaixo da meta", className: "bg-danger/10 text-danger" },
};

/** Semáforo da margem líquida. Cor + texto (não depende só da cor, por causa de daltonismo e sol na tela). */
export function MarginBadge({ status, pct }: { status: MarginStatus; pct: number }) {
  const s = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      {s.label} · {formatPct(pct)}
    </span>
  );
}
