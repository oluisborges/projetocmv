"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { D, baseUnitOf, fromBaseQty, grossQty, toBaseQty, unitsFor, type PurchaseUnit } from "@/lib/calc";
import { Hint } from "@/components/hint";
import { formatBRL, formatNumber, parseDecimal, UNIT_LABEL } from "@/lib/format";
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
/** `netQty` fica SEMPRE na unidade-base (g/ml/un); `unit` é só como o dono vê e digita. */
export type EditorItem = { id: string; ingredientId: string; netQty: number; unit: PurchaseUnit; scope: "batch" | "portion" };
export type EditorRecipe = {
  /** serving = UMA marmita (só gramas); batch = lote (aceita kg/l) */
  mode: "serving" | "batch";
  id: string;
  name: string;
  portions: number | null;
  portionWeightGrams: number | null;
  portionWeightUnit: "g" | "kg";
  cookingLossPct: number;
};

/** 1.5 -> "1,5". Até 4 casas, sem zeros sobrando. */
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Number(n.toFixed(4))).replace(".", ","));

const inputClass =
  "h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

const baseOf = (ing: EditorIngredient) => baseUnitOf(ing.purchase_unit as PurchaseUnit);

function UnitSelect({ value, options, onChange, disabled, label }: { value: string; options: PurchaseUnit[]; onChange: (u: PurchaseUnit) => void; disabled?: boolean; label: string }) {
  // Dentro da marmita tudo é g (ml para líquido, un para unidade): sem escolha, só o rótulo.
  if (options.length === 1) {
    return (
      <span className="w-9 text-sm text-muted" title={label}>
        {UNIT_LABEL[options[0]]}
      </span>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PurchaseUnit)}
      disabled={disabled || options.length < 2}
      aria-label={label}
      className="h-11 rounded-xl border border-border bg-surface px-2 text-base outline-none focus:border-primary disabled:opacity-60"
    >
      {options.map((u) => (
        <option key={u} value={u}>
          {UNIT_LABEL[u]}
        </option>
      ))}
    </select>
  );
}

function ItemRow({
  item,
  ingredient,
  canWrite,
  perPortion,
  lockUnit,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  ingredient: EditorIngredient;
  canWrite: boolean;
  perPortion: boolean;
  lockUnit: boolean;
  onChange: (qty: number, unit: PurchaseUnit) => void;
  onRemove: () => void;
}) {
  const shown = (qty: number, unit: PurchaseUnit) => fmt(fromBaseQty(qty, unit).toNumber());
  const [text, setText] = useState(shown(item.netQty, item.unit));
  const [error, setError] = useState<string>();
  const cost = D(ingredient.unit_cost).mul(grossQty(item.netQty, ingredient.correction_factor)).toNumber();

  async function save(nextText: string, unit: PurchaseUnit) {
    const result = await updateRecipeItemQty(item.id, nextText, unit);
    if (result.ok) {
      setError(undefined);
      setText(shown(result.qty, unit));
      onChange(result.qty, unit);
    } else {
      setError(result.error);
    }
  }

  // Trocar a unidade não muda a quantidade: 500 g vira 0,5 kg.
  function changeUnit(unit: PurchaseUnit) {
    const next = shown(item.netQty, unit);
    setText(next);
    void save(next, unit);
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium leading-snug">{ingredient.name}</p>
          <p className="text-xs text-muted">
            {ingredient.unit_cost <= 0 ? <span className="text-warning">sem preço</span> : formatBRL(cost)}
            {ingredient.correction_factor > 1 ? ` · FC ${formatNumber(ingredient.correction_factor, 2)}` : ""}
            {ingredient.archived ? " · arquivado" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() !== shown(item.netQty, item.unit) && void save(text, item.unit)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            inputMode="decimal"
            disabled={!canWrite}
            aria-label={`Quantidade de ${ingredient.name}`}
            aria-invalid={Boolean(error)}
            className="tabular h-11 w-20 rounded-xl border border-border bg-surface px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <UnitSelect value={item.unit} options={lockUnit ? [baseOf(ingredient)] : unitsFor(baseOf(ingredient))} onChange={changeUnit} disabled={!canWrite} label={`Unidade de ${ingredient.name}`} />
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover ${ingredient.name}${perPortion ? " da embalagem" : ""}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl leading-none text-muted active:bg-background"
          >
            ×
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function AddItem({
  recipeId,
  options,
  defaultQty,
  label,
  lockUnit,
  onAdded,
}: {
  recipeId: string;
  options: EditorIngredient[];
  defaultQty: string;
  label: string;
  lockUnit: boolean;
  onAdded: (item: EditorItem) => void;
}) {
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState(defaultQty);
  const [unit, setUnit] = useState<PurchaseUnit>("g");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const selected = options.find((o) => o.id === ingredientId);
  const unitOptions: PurchaseUnit[] = selected ? (lockUnit ? [baseOf(selected)] : unitsFor(baseOf(selected))) : ["g"];

  function choose(id: string) {
    setIngredientId(id);
    const ing = options.find((o) => o.id === id);
    if (ing) setUnit(baseOf(ing) === "g" ? "g" : baseOf(ing) === "ml" ? "ml" : "un");
  }

  async function add() {
    if (!selected) return setError("Escolha o item.");
    setBusy(true);
    const result = await addRecipeItem({ recipeId, ingredientId, qty, unit });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onAdded({ id: result.itemId, ingredientId, netQty: result.qty, unit: unit, scope: selected.kind === "embalagem" ? "portion" : "batch" });
    setIngredientId("");
    setQty(defaultQty);
    setError(undefined);
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted">Todos os itens já estão na ficha. Cadastre mais em Insumos.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <select value={ingredientId} onChange={(e) => choose(e.target.value)} aria-label={label} className={inputClass}>
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.unit_cost <= 0 ? " (sem preço)" : ""}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" aria-label="Quantidade" placeholder="Quantidade" className={`${inputClass} text-right`} />
        <UnitSelect value={unit} options={unitOptions} onChange={setUnit} label="Unidade da quantidade" />
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
  const router = useRouter();
  const isServing = recipe.mode === "serving";
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState(recipe.name);
  const [portions, setPortions] = useState(fmt(recipe.portions));
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">(recipe.portionWeightUnit);
  const [portionWeight, setPortionWeight] = useState(
    recipe.portionWeightGrams === null ? "" : fmt(fromBaseQty(recipe.portionWeightGrams, recipe.portionWeightUnit).toNumber()),
  );
  const [cookingLoss, setCookingLoss] = useState(fmt(Number((recipe.cookingLossPct * 100).toFixed(2))));
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const view = useMemo(() => {
    const num = (s: string) => {
      const p = parseDecimal(s);
      return p === null ? null : Number(p);
    };
    const typedWeight = num(portionWeight);
    return computeRecipe(
      {
        portions: isServing ? 1 : num(portions),
        portionWeight: typedWeight === null ? null : toBaseQty(typedWeight, weightUnit).toNumber(),
        cookingLossPct: isServing ? 0 : (num(cookingLoss) ?? 0) / 100,
      },
      items.flatMap((i) => (byId.has(i.ingredientId) ? [{ ingredient: byId.get(i.ingredientId)!, netQty: i.netQty, scope: i.scope }] : [])),
    );
  }, [items, portions, portionWeight, weightUnit, cookingLoss, byId, isServing]);

  async function saveSettings(over: { portionWeight?: string; weightUnit?: "g" | "kg" } = {}): Promise<boolean> {
    setStatus({ kind: "saving" });
    const result = await updateRecipeSettings({
      id: recipe.id,
      name,
      portions,
      portionWeight: over.portionWeight ?? portionWeight,
      portionWeightUnit: over.weightUnit ?? weightUnit,
      cookingLoss,
    });
    if (result.ok) {
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
      return true;
    }
    setStatus({ kind: "error", message: result.error });
    return false;
  }

  // Trocar g/kg não muda o peso: 300 g vira 0,3 kg.
  function changeWeightUnit(next: "g" | "kg") {
    const typed = parseDecimal(portionWeight);
    const converted = typed === null ? portionWeight : fmt(fromBaseQty(toBaseQty(Number(typed), weightUnit), next).toNumber());
    setPortionWeight(converted);
    setWeightUnit(next);
    void saveSettings({ portionWeight: converted, weightUnit: next });
  }

  async function finish() {
    if (canWrite && !(await saveSettings())) return;
    router.push("/fichas");
  }

  const usedIds = new Set(items.map((i) => i.ingredientId));
  const available = (kind: "insumo" | "embalagem") => ingredients.filter((i) => i.kind === kind && !i.archived && !usedIds.has(i.id));

  const removeItem = async (item: EditorItem) => {
    const result = await removeRecipeItem(item.id);
    if (result.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    else setStatus({ kind: "error", message: result.error });
  };

  const itemsOf = (scope: "batch" | "portion") => items.filter((i) => i.scope === scope && byId.has(i.ingredientId));

  const renderItems = (scope: "batch" | "portion") =>
    itemsOf(scope).length > 0 ? (
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
        {itemsOf(scope).map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            ingredient={byId.get(item.ingredientId)!}
            canWrite={canWrite}
            perPortion={scope === "portion"}
            lockUnit={isServing || scope === "portion"}
            onChange={(qty, unit) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, netQty: qty, unit } : i)))}
            onRemove={() => removeItem(item)}
          />
        ))}
      </ul>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-live="polite" className="sticky top-14 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        {view.ok ? (
          <div className="flex flex-col gap-1">
            <p className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted">
              {isServing ? "Custo da marmita" : "Custo por porção"}
              <Hint>
                {isServing
                  ? "Quanto custa fazer UMA marmita: a soma dos ingredientes que vão nela mais a embalagem."
                  : "Quanto custa fazer UMA marmita: a parte dos ingredientes do lote dividida pelas porções, mais a embalagem."}
              </Hint>
            </p>
            <div className="flex items-baseline justify-between gap-3">
              <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(view.cost.costPerPortion.toNumber())}</p>
              {isServing ? null : (
                <p className="tabular text-right text-xs text-muted">
                  Lote {formatBRL(view.cost.batchCost.toNumber())} · {formatNumber(view.cost.portions.toNumber(), 0)} porções
                </p>
              )}
            </div>
            <p className="tabular text-xs text-muted">
              Ingredientes {formatBRL(view.cost.ingredientCostPerPortion.toNumber())} + embalagem {formatBRL(view.cost.packagingCostPerPortion.toNumber())}
            </p>
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
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{isServing ? "Ingredientes de UMA marmita" : "Ingredientes do lote"}</h2>
        {renderItems("batch")}
        {canWrite ? (
          <AddItem recipeId={recipe.id} options={available("insumo")} defaultQty="" label="Escolha o ingrediente" lockUnit={isServing} onAdded={(item) => setItems((prev) => [...prev, item])} />
        ) : null}
        <p className="text-xs text-muted">
          {isServing
            ? "Digite quantos gramas vão em UMA marmita, já limpo e pronto para usar. O custo considera a perda de limpeza (fator de correção) sozinho."
            : "Digite a quantidade do LOTE INTEIRO (a receita toda), já limpa. Dá para usar kg ou g. O custo considera a perda de limpeza sozinho."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{isServing ? "Embalagem da marmita" : "Embalagem (por porção)"}</h2>
        {renderItems("portion")}
        {canWrite ? (
          <AddItem recipeId={recipe.id} options={available("embalagem")} defaultQty="1" label="Bandeja, filme, etiqueta…" lockUnit onAdded={(item) => setItems((prev) => [...prev, item])} />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{isServing ? "Nome" : "Rendimento"}</h2>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {isServing ? "Nome da marmita" : "Nome"}
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => saveSettings()} disabled={!canWrite} className={inputClass} />
        </label>
        {isServing ? null : (
          <>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Rende (porções)
          <input value={portions} onChange={(e) => setPortions(e.target.value)} onBlur={() => saveSettings()} inputMode="decimal" disabled={!canWrite} className={inputClass} />
        </label>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <label htmlFor="portion-weight">Peso da porção</label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <input
              id="portion-weight"
              value={portionWeight}
              onChange={(e) => setPortionWeight(e.target.value)}
              onBlur={() => saveSettings()}
              inputMode="decimal"
              disabled={!canWrite}
              className={inputClass}
            />
            <UnitSelect value={weightUnit} options={["g"]} onChange={(u) => changeWeightUnit(u as "g" | "kg")} disabled={!canWrite} label="Unidade do peso da porção" />
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>
            Perda de cocção (%)
            <Hint>Quanto a comida perde de peso ao cozinhar. Serve para calcular quantas porções saem quando você informa o peso da porção.</Hint>
          </span>
          <input value={cookingLoss} onChange={(e) => setCookingLoss(e.target.value)} onBlur={() => saveSettings()} inputMode="decimal" disabled={!canWrite} className={inputClass} />
        </label>
          </>
        )}
        <p role={status.kind === "error" ? "alert" : undefined} className="min-h-5 text-sm">
          {status.kind === "saving" ? <span className="text-muted">Salvando…</span> : null}
          {status.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
          {status.kind === "error" ? <span className="text-danger">{status.message}</span> : null}
        </p>
      </section>

      <div className="flex flex-col gap-2">
        <button type="button" onClick={finish} className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">
          Concluir
        </button>
        <p className="text-center text-xs text-muted">Tudo é salvo automaticamente enquanto você edita. Este botão só volta para a lista.</p>
      </div>
    </div>
  );
}
