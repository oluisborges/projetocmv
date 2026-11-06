"use client";

import { useState, useTransition } from "react";
import { saveItemOrder } from "@/app/(app)/cardapio/actions";

type Item = { id: string; name: string; net: string; tag: "insumo" | "receita" };

const TAG = { insumo: "Ingrediente", receita: "Receita" } as const;

/** Ordem de montagem: do primeiro item a entrar na embalagem ao último, com setas para subir e descer. Vale na ficha impressa. */
export function MontagemOrder({ recipeId, items, ordered, canWrite }: { recipeId: string; items: Item[]; /** Algum item já tem ordem escolhida (senão a lista está do mais caro ao mais barato). */ ordered: boolean; canWrite: boolean }) {
  const [list, setList] = useState(items);
  const [chosen, setChosen] = useState(ordered);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    const before = list;
    setList(next);
    setChosen(true);
    setError(null);
    start(async () => {
      const res = await saveItemOrder(recipeId, next.map((i) => i.id));
      if (!res.ok) {
        setList(before);
        setError(res.error);
      }
    });
  };

  if (list.length === 0) return <p className="rounded-lg bg-black/5 px-3 py-2 text-xs text-muted">Ainda sem itens. Adicione na aba Itens.</p>;
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col divide-y divide-border rounded-lg bg-black/5 px-3 py-1 text-sm">
        {list.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 py-1.5">
            <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{it.name}</span>
              <span className="block text-xs text-muted">
                = {it.net} · {TAG[it.tag]}
              </span>
            </span>
            {canWrite ? (
              <span className="flex shrink-0 gap-1">
                <button type="button" disabled={pending || i === 0} onClick={() => move(i, i - 1)} aria-label={`Subir ${it.name}`} className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-base disabled:opacity-30">
                  ↑
                </button>
                <button type="button" disabled={pending || i === list.length - 1} onClick={() => move(i, i + 1)} aria-label={`Descer ${it.name}`} className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-base disabled:opacity-30">
                  ↓
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      {!chosen ? <p className="text-xs text-muted">Sem ordem escolhida: a ficha mostra do item mais caro ao mais barato. Mexa nas setas para definir a ordem de montagem.</p> : null}
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
