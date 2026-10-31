import type { FichaOptionItem } from "@/lib/ficha-tecnica-data";

const TAG_LABEL = { insumo: "Ingrediente", receita: "Receita", embalagem: "Embalagem" } as const;
const TAG_STYLE = { insumo: "bg-primary/10 text-primary", receita: "bg-warning/10 text-warning", embalagem: "bg-black/10 text-muted" } as const;

/** O que tem dentro de um produto ou receita, em linhas curtas: nome, "= quantidade" e a etiqueta do tipo. */
export function FichaItems({ items }: { items: FichaOptionItem[] }) {
  if (items.length === 0) return <p className="rounded-lg bg-black/5 px-3 py-2 text-xs text-muted">Ainda sem itens.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg bg-black/5 px-3 py-1 text-sm">
      {items.map((it, i) => (
        <li key={`${it.name}-${i}`} className="flex items-center gap-2 py-1.5">
          <span className="min-w-0 flex-1 truncate">{it.name}</span>
          <span className="tabular shrink-0 text-xs font-semibold text-muted">= {it.net}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_STYLE[it.tag]}`}>{TAG_LABEL[it.tag]}</span>
        </li>
      ))}
    </ul>
  );
}
