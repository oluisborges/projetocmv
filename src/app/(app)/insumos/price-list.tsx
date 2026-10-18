"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysSince, formatAge, formatPurchaseSize, STALE_DAYS } from "@/lib/format";
import { updateIngredientPrice } from "./actions";
import { Spinner } from "@/components/spinner";

export type IngredientRow = {
  id: string;
  name: string;
  category: string | null;
  kind: string;
  purchase_unit: string;
  purchase_qty: number;
  purchase_price: number;
  price_updated_at: string;
};

const priceInput = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

type Status = "idle" | "saving" | "saved" | "error";

function PriceRow({ item, canWrite }: { item: IngredientRow; canWrite: boolean }) {
  const [saved, setSaved] = useState(item.purchase_price);
  const [text, setText] = useState(item.purchase_price > 0 ? priceInput.format(item.purchase_price) : "");
  const [updatedAt, setUpdatedAt] = useState(item.price_updated_at);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();

  const age = daysSince(updatedAt);
  const noPrice = saved <= 0;
  const stale = !noPrice && age > STALE_DAYS;

  async function commit() {
    const trimmed = text.trim();
    if (trimmed === "" || trimmed === (saved > 0 ? priceInput.format(saved) : "")) return;

    setStatus("saving");
    setError(undefined);
    const result = await updateIngredientPrice(item.id, trimmed);
    if (result.ok) {
      setSaved(result.price);
      setText(priceInput.format(result.price));
      setUpdatedAt(new Date().toISOString());
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/insumos/${item.id}`} className="tap-area block truncate font-medium">
            {item.name}
          </Link>
          <p className="truncate text-xs text-muted">
            por {formatPurchaseSize(item.purchase_qty, item.purchase_unit)}
            {item.category ? ` · ${item.category}` : ""}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Preço de {item.name}</span>
          <span aria-hidden className="text-sm text-muted">
            R$
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Enter salva (ao sair do campo) e já pula para o preço de baixo: atualizar 20 preços sem tocar na tela.
              const next = e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input");
              e.currentTarget.blur();
              next?.focus();
            }}
            inputMode="decimal"
            enterKeyHint="next"
            disabled={!canWrite}
            placeholder="0,00"
            aria-invalid={status === "error"}
            className={`tabular h-11 w-28 rounded-xl border bg-surface px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${
              status === "error" ? "border-danger" : noPrice ? "border-warning" : "border-border"
            }`}
          />
        </label>
      </div>

      <p role={status === "error" ? "alert" : undefined} className="min-h-4 text-right text-xs">
        {status === "saving" ? (
          <span className="inline-flex items-center gap-1 text-muted"><Spinner className="size-3" />Salvando…</span>
        ) : status === "saved" ? (
          <span className="text-success">Salvo ✓</span>
        ) : status === "error" ? (
          <span className="text-danger">{error}</span>
        ) : noPrice ? (
          <span className="text-warning">Falta o preço</span>
        ) : stale ? (
          <span className="text-warning">Preço de {formatAge(age)}: ainda vale?</span>
        ) : (
          <span className="text-muted">Atualizado {formatAge(age)}</span>
        )}
      </p>
    </li>
  );
}

export function PriceList({ items, canWrite }: { items: IngredientRow[]; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [onlyPending, setOnlyPending] = useState(false);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort(), [items]);

  const pendingCount = items.filter((i) => i.purchase_price <= 0 || daysSince(i.price_updated_at) > STALE_DAYS).length;

  const visible = items.filter((i) => {
    if (category && i.category !== category) return false;
    if (onlyPending && !(i.purchase_price <= 0 || daysSince(i.price_updated_at) > STALE_DAYS)) return false;
    if (query && !i.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });

  const chip = (active: boolean) =>
    `h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;

  return (
    <section className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar insumo…"
        aria-label="Buscar insumo"
        className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button type="button" className={chip(onlyPending)} onClick={() => setOnlyPending((v) => !v)} aria-pressed={onlyPending}>
          Precisa atualizar ({pendingCount})
        </button>
        <button type="button" className={chip(category === "")} onClick={() => setCategory("")}>
          Todos
        </button>
        {categories.map((c) => (
          <button key={c} type="button" className={chip(category === c)} onClick={() => setCategory(category === c ? "" : c)}>
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nenhum insumo encontrado.</p>
      ) : (
        <ul className="divide-y divide-border card px-4">
          {visible.map((item) => (
            <PriceRow key={item.id} item={item} canWrite={canWrite} />
          ))}
        </ul>
      )}
    </section>
  );
}
