"use client";

import { useMemo, useState } from "react";
import { D, baseUnitOf, grossQty, type PurchaseUnit } from "@/lib/calc";
import { Hint } from "@/components/hint";
import { formatBRL, formatNumber, parseDecimal } from "@/lib/format";
import { computeRecipe } from "@/lib/recipe-cost";
import { addRecipeItem, removeRecipeItem, updateRecipeItemQty, updateRecipeSettings } from "../actions";

export type EditorIngredient = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem";
  purchase_unit: string;
  unit_cost: number;
  correction_factor: number;
  archived: boolean;
};
export type EditorItem = { id: string; ingredientId: string; netQty: number; scope: "batch" | "portion" };
export type EditorRecipe = { id: string; name: string; portions: number | null; portionWeight: number | null; cookingLossPct: number };

const comma = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

const inputClass =
  "h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

function ItemRow({
  item,
  ingredient,
  canWrite,
  perPortion,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  ingredient: EditorIngredient;
  canWrite: boolean;
  perPortion: boolean;
  onChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(comma(item.netQty));
  const [error, setError] = useState<string>();
  const unit = baseUnitOf(ingredient.purchase_unit as PurchaseUnit);
  const cost = D(ingredient.unit_cost).mul(grossQty(item.netQty, ingredient.correction_factor)).toNumber();

  async function commit() {
    if (text.trim() === comma(item.netQty)) return;
    const result = await updateRecipeItemQty(item.id, text);
    if (result.ok) {
      setError(undefined);
      setText(comma(result.qty));
      onChange(result.qty);
    } else {
      setError(result.error);
    }
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{ingredient.name}</p>
          <p className="text-xs text-muted">
            {ingredient.unit_cost <= 0 ? <span className="text-warning">sem preço</span> : formatBRL(cost)}
            {ingredient.correction_factor > 1 ? ` · FC ${formatNumber(ingredient.correction_factor, 2)}` : ""}
            {ingredient.archived ? " · arquivado" : ""}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="sr-only">Quantidade de {ingredient.name}</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            inputMode="decimal"
            disabled={!canWrite}
            aria-invalid={Boolean(error)}
            className="tabular h-11 w-24 rounded-xl border border-border bg-surface px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <span className="w-8 text-sm text-muted">{unit}</span>
        </label>
      </div>
      <div className="flex items-center justify-between">
        <p role={error ? "alert" : undefined} className="text-xs text-danger">
          {error}
        </p>
        {canWrite ? (
          <button type="button" onClick={onRemove} className="h-9 text-xs font-semibold text-danger">
            Remover{perPortion ? " embalagem" : ""}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function AddItem({
  recipeId,
  options,
  defaultQty,
  label,
  onAdded,
}: {
  recipeId: string;
  options: EditorIngredient[];
  defaultQty: string;
  label: string;
  onAdded: (item: EditorItem) => void;
}) {
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState(defaultQty);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!ingredientId) return setError("Escolha o item.");
    setBusy(true);
    const result = await addRecipeItem({ recipeId, ingredientId, qty });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    const ing = options.find((o) => o.id === ingredientId)!;
    const parsed = Number(parseDecimal(qty) ?? 0);
    onAdded({ id: result.itemId, ingredientId, netQty: parsed, scope: ing.kind === "embalagem" ? "portion" : "batch" });
    setIngredientId("");
    setQty(defaultQty);
    setError(undefined);
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted">Todos os itens já estão na ficha. Cadastre mais em Insumos.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} aria-label={label} className={inputClass}>
          <option value="">{label}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.unit_cost <= 0 ? " (sem preço)" : ""}
            </option>
          ))}
        </select>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          aria-label="Quantidade"
          placeholder="Qtd"
          className={`${inputClass} text-right`}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={add} disabled={busy} className="h-11 rounded-xl border border-primary text-sm font-semibold text-primary disabled:opacity-60">
        {busy ? "Adicionando…" : "+ Adicionar"}
      </button>
    </div>
  );
}

export function RecipeEditor({
  recipe,
  initialItems,
  ingredients,
  canWrite,
}: {
  recipe: EditorRecipe;
  initialItems: EditorItem[];
  ingredients: EditorIngredient[];
  canWrite: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState(recipe.name);
  const [portions, setPortions] = useState(comma(recipe.portions));
  const [portionWeight, setPortionWeight] = useState(comma(recipe.portionWeight));
  const [cookingLoss, setCookingLoss] = useState(comma(Number((recipe.cookingLossPct * 100).toFixed(2))));
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const view = useMemo(() => {
    const num = (s: string) => {
      const p = parseDecimal(s);
      return p === null ? null : Number(p);
    };
    return computeRecipe(
      { portions: num(portions), portionWeight: num(portionWeight), cookingLossPct: (num(cookingLoss) ?? 0) / 100 },
      items.flatMap((i) => (byId.has(i.ingredientId) ? [{ ingredient: byId.get(i.ingredientId)!, netQty: i.netQty, scope: i.scope }] : [])),
    );
  }, [items, portions, portionWeight, cookingLoss, byId]);

  async function saveSettings() {
    setStatus({ kind: "saving" });
    const result = await updateRecipeSettings({ id: recipe.id, name, portions, portionWeight, cookingLoss });
    if (result.ok) {
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  const usedIds = new Set(items.map((i) => i.ingredientId));
  const available = (kind: "insumo" | "embalagem") => ingredients.filter((i) => i.kind === kind && !i.archived && !usedIds.has(i.id));

  const removeItem = async (item: EditorItem) => {
    const result = await removeRecipeItem(item.id);
    if (result.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    else setStatus({ kind: "error", message: result.error });
  };

  const itemsOf = (scope: "batch" | "portion") => items.filter((i) => i.scope === scope && byId.has(i.ingredientId));

  return (
    <div className="flex flex-col gap-6">
      <section aria-live="polite" className="sticky top-[57px] z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        {view.ok ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Custo por porção
                <Hint>Quanto custa fazer UMA marmita: a parte dos ingredientes do lote dividida pelas porções, mais a embalagem.</Hint>
              </p>
              <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(view.cost.costPerPortion.toNumber())}</p>
            </div>
            <div className="text-right text-xs text-muted">
              <p>
                Ingredientes {formatBRL(view.cost.ingredientCostPerPortion.toNumber())} + embalagem {formatBRL(view.cost.packagingCostPerPortion.toNumber())}
              </p>
              <p>
                Lote {formatBRL(view.cost.batchCost.toNumber())} · {formatNumber(view.cost.portions.toNumber(), 0)} porções
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            {view.reason === "no-items"
              ? "Adicione os ingredientes para ver o custo."
              : view.reason === "no-portions"
                ? "Informe quantas porções a receita rende (ou o peso de cada porção)."
                : "Confira as porções e a perda de cocção."}
          </p>
        )}
        {view.ok && view.missingPrices > 0 ? (
          <p className="pt-1 text-xs text-warning">
            {view.missingPrices} {view.missingPrices === 1 ? "item sem preço" : "itens sem preço"}: o custo está incompleto. Preencha em Insumos.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Ingredientes do lote</h2>
        {itemsOf("batch").length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {itemsOf("batch").map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                ingredient={byId.get(item.ingredientId)!}
                canWrite={canWrite}
                perPortion={false}
                onChange={(qty) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, netQty: qty } : i)))}
                onRemove={() => removeItem(item)}
              />
            ))}
          </ul>
        ) : null}
        {canWrite ? (
          <AddItem
            recipeId={recipe.id}
            options={available("insumo")}
            defaultQty=""
            label="Escolha o ingrediente"
            onAdded={(item) => setItems((prev) => [...prev, item])}
          />
        ) : null}
        <p className="text-xs text-muted">
          Digite a quantidade LIMPA, já pronta para usar, em gramas (ou ml). O custo já considera a perda de limpeza (fator de correção).
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Embalagem (por porção)</h2>
        {itemsOf("portion").length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {itemsOf("portion").map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                ingredient={byId.get(item.ingredientId)!}
                canWrite={canWrite}
                perPortion
                onChange={(qty) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, netQty: qty } : i)))}
                onRemove={() => removeItem(item)}
              />
            ))}
          </ul>
        ) : null}
        {canWrite ? (
          <AddItem
            recipeId={recipe.id}
            options={available("embalagem")}
            defaultQty="1"
            label="Bandeja, filme, etiqueta…"
            onAdded={(item) => setItems((prev) => [...prev, item])}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Rendimento</h2>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveSettings} disabled={!canWrite} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Rende (porções)
            <input value={portions} onChange={(e) => setPortions(e.target.value)} onBlur={saveSettings} inputMode="decimal" disabled={!canWrite} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Peso da porção (g)
            <input value={portionWeight} onChange={(e) => setPortionWeight(e.target.value)} onBlur={saveSettings} inputMode="decimal" disabled={!canWrite} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>
            Perda de cocção (%)
            <Hint>Quanto a comida perde de peso ao cozinhar. Serve para calcular quantas porções saem quando você informa o peso da porção.</Hint>
          </span>
          <input value={cookingLoss} onChange={(e) => setCookingLoss(e.target.value)} onBlur={saveSettings} inputMode="decimal" disabled={!canWrite} className={inputClass} />
        </label>
        <p role={status.kind === "error" ? "alert" : undefined} className="min-h-5 text-sm">
          {status.kind === "saving" ? <span className="text-muted">Salvando…</span> : null}
          {status.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
          {status.kind === "error" ? <span className="text-danger">{status.message}</span> : null}
        </p>
      </section>
    </div>
  );
}
