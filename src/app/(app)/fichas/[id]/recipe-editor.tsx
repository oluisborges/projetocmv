"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { D, baseUnitOf, fromBaseQty, grossQty, toBaseQty, unitsFor, type PurchaseUnit } from "@/lib/calc";
import { Hint } from "@/components/hint";
import { formatBRL, formatNumber, parseDecimal, UNIT_LABEL } from "@/lib/format";
import { computeRecipe } from "@/lib/recipe-cost";
import { addRecipeItem, removeRecipeItem, updateRecipeDetails, updateRecipeItemQty, updateRecipeSettings } from "../actions";

export type EditorIngredient = {
  id: string;
  name: string;
  kind: "insumo" | "embalagem";
  purchase_unit: string;
  unit_cost: number;
  correction_factor: number;
  /** Peso pronto ÷ peso cru. 1 = não muda. Só vale em ficha por unidade. */
  cooking_yield: number;
  category: string | null;
  archived: boolean;
};

/** Categorias que quase sempre mudam de peso ao cozinhar: se o rendimento ficou em 1, provavelmente foi esquecido. */
const CHANGES_WEIGHT = /prote|gr[ãa]o|massa/i;
/** `netQty` fica SEMPRE na unidade-base (g/ml/un); `unit` é só como o dono vê e digita. */
export type EditorItem = { id: string; ingredientId: string; netQty: number; unit: PurchaseUnit; scope: "batch" | "portion" };
export type EditorRecipe = {
  /** serving = UMA unidade (só gramas); batch = lote (aceita kg/l) */
  mode: "serving" | "batch";
  id: string;
  name: string;
  portions: number | null;
  portionWeightGrams: number | null;
  portionWeightUnit: "g" | "kg";
  cookingLossPct: number;
  code: string;
  portionNote: string;
};

/** 1.5 -> "1,5". Até 4 casas, sem zeros sobrando. */
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Number(n.toFixed(4))).replace(".", ","));

const inputClass =
  "h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

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
      className="h-11 card px-2 text-base outline-none focus:border-primary disabled:opacity-60"
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
  yieldFactor,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  ingredient: EditorIngredient;
  canWrite: boolean;
  perPortion: boolean;
  lockUnit: boolean;
  /** Rendimento aplicado a este item (1 quando a ficha é em lote ou o item é embalagem). */
  yieldFactor: number;
  onChange: (qty: number, unit: PurchaseUnit) => void;
  onRemove: () => void;
}) {
  const shown = (qty: number, unit: PurchaseUnit) => fmt(fromBaseQty(qty, unit).toNumber());
  const [text, setText] = useState(shown(item.netQty, item.unit));
  const [error, setError] = useState<string>();
  const cost = D(ingredient.unit_cost).mul(grossQty(D(item.netQty).div(yieldFactor), ingredient.correction_factor)).toNumber();

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
            className="tabular h-11 w-20 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
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
      {perPortion || yieldFactor !== 1 || !lockUnit || !CHANGES_WEIGHT.test(ingredient.category ?? "") ? null : (
        <p className="text-xs text-warning">
          Rendimento não informado: {ingredient.name} muda de peso ao cozinhar e o custo pode estar alto demais.{" "}
          <Link href={`/insumos/${ingredient.id}`} className="font-semibold underline">
            Informar
          </Link>
        </p>
      )}
    </li>
  );
}

function AddItem({
  recipeId,
  options,
  defaultQty,
  label,
  field,
  title,
  lockUnit,
  onAdded,
}: {
  recipeId: string;
  options: EditorIngredient[];
  defaultQty: string;
  /** Texto de orientação dentro da lista ("Escolha o ingrediente"): não é uma opção, some ao escolher. */
  label: string;
  /** Nome do campo, escrito acima da lista ("Ingrediente", "Embalagem"). */
  field: string;
  /** Texto do botão que abre o formulário. */
  title: string;
  lockUnit: boolean;
  onAdded: (item: EditorItem) => void;
}) {
  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState(defaultQty);
  const [unit, setUnit] = useState<PurchaseUnit>("g");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

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
    setOpen(false);
  }

  if (options.length === 0) {
    return <p className="text-sm text-muted">Todos os itens já estão na ficha. Cadastre mais em Insumos.</p>;
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-12 rounded-xl border border-dashed border-primary text-sm font-semibold text-primary">
        + {title}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 card p-3">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {field}
        <span className="relative">
          <select value={ingredientId} onChange={(e) => choose(e.target.value)} className={`${inputClass} w-full appearance-none pr-10 ${ingredientId ? "" : "text-muted"}`}>
            <option value="" disabled hidden>
              {label}
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id} className="text-foreground">
                {o.name}
                {o.unit_cost <= 0 ? " (sem preço)" : ""}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">
            ▾
          </span>
        </span>
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" aria-label="Quantidade" placeholder="Quantidade" className={`${inputClass} text-right`} />
        <UnitSelect value={unit} options={unitOptions} onChange={setUnit} label="Unidade da quantidade" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-xl border border-border text-sm font-semibold">
          Cancelar
        </button>
        <button type="button" onClick={add} disabled={busy} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Adicionando…" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

export function RecipeEditor({
  recipe,
  initialItems,
  ingredients,
  canWrite,
  safetyMarginPct,
}: {
  recipe: EditorRecipe;
  initialItems: EditorItem[];
  ingredients: EditorIngredient[];
  canWrite: boolean;
  /** Margem de segurança sobre os insumos, vinda dos Ajustes (fração). */
  safetyMarginPct: number;
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
  const [code, setCode] = useState(recipe.code);
  const [note, setNote] = useState(recipe.portionNote);
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
        useCookingYield: isServing,
        safetyMarginPct,
      },
      items.flatMap((i) => (byId.has(i.ingredientId) ? [{ ingredient: byId.get(i.ingredientId)!, netQty: i.netQty, scope: i.scope }] : [])),
    );
  }, [items, portions, portionWeight, weightUnit, cookingLoss, byId, isServing, safetyMarginPct]);

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
      router.refresh(); // o título da página vem do servidor
      return true;
    }
    setStatus({ kind: "error", message: result.error });
    return false;
  }

  async function saveDetails() {
    setStatus({ kind: "saving" });
    const result = await updateRecipeDetails({ id: recipe.id, code, note });
    if (result.ok) {
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
      router.refresh(); // a data da última alteração vem do servidor
    } else {
      setStatus({ kind: "error", message: result.error });
    }
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
      <ul className="divide-y divide-border card px-4">
        {itemsOf(scope).map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            ingredient={byId.get(item.ingredientId)!}
            canWrite={canWrite}
            perPortion={scope === "portion"}
            lockUnit={isServing || scope === "portion"}
            yieldFactor={isServing && scope === "batch" ? byId.get(item.ingredientId)!.cooking_yield : 1}
            onChange={(qty, unit) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, netQty: qty, unit } : i)))}
            onRemove={() => removeItem(item)}
          />
        ))}
      </ul>
    ) : null;

  const savedChip =
    status.kind === "saving" ? <span className="text-xs text-muted">Salvando…</span> : status.kind === "saved" ? <span className="text-xs text-success">Salvo ✓</span> : null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-live="polite" className="sticky top-16 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        {view.ok ? (
          <div className="flex flex-col gap-0.5">
            <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
              <span>
                {isServing ? "Custo do produto" : "Custo por porção"}
                <Hint>
                  {isServing
                    ? "Quanto custa fazer UMA unidade: a soma dos ingredientes que vão nela mais a embalagem."
                    : "Quanto custa fazer UMA unidade: a parte dos ingredientes do lote dividida pelas porções, mais a embalagem."}
                </Hint>
              </span>
              {savedChip}
            </p>
            <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(view.cost.costPerPortion.toNumber())}</p>
            {isServing ? null : (
              <p className="tabular text-xs text-muted">
                Lote {formatBRL(view.cost.batchCost.toNumber())} · {formatNumber(view.cost.portions.toNumber(), 0)} porções
              </p>
            )}
            {safetyMarginPct > 0 ? (
              <p className="text-xs text-muted">
                Inclui {formatNumber(safetyMarginPct * 100, 1)}% de margem de segurança nos insumos.{" "}
                <Link href="/precificacao/ajustes" className="font-semibold text-primary underline">
                  Alterar
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {view.reason === "no-items"
                ? "Adicione os ingredientes para ver o custo."
                : view.reason === "no-portions"
                  ? "Informe quantas porções a receita rende (ou o peso de cada porção)."
                  : "Confira as porções e a perda de cocção."}
            </p>
            {savedChip}
          </div>
        )}
        {view.ok && view.missingPrices > 0 ? (
          <p className="pt-1 text-xs text-warning">
            {view.missingPrices} {view.missingPrices === 1 ? "item sem preço" : "itens sem preço"}: o custo está incompleto. Preencha em Insumos.
          </p>
        ) : null}
        {status.kind === "error" ? (
          <p role="alert" className="pt-1 text-sm text-danger">
            {status.message}
          </p>
        ) : null}
      </section>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => saveSettings()} disabled={!canWrite} className={inputClass} />
      </label>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{isServing ? "Ingredientes de UMA unidade" : "Ingredientes do lote"}</h2>
        {renderItems("batch")}
        {canWrite ? (
          <AddItem recipeId={recipe.id} options={available("insumo")} defaultQty="" label="Escolha o ingrediente" field="Ingrediente" title="Adicionar ingrediente" lockUnit={isServing} onAdded={(item) => setItems((prev) => [...prev, item])} />
        ) : null}
        <p className="text-xs text-muted">
          {isServing ? "Digite as gramas PRONTAS, do jeito que vai na embalagem (arroz já cozido, frango já grelhado)." : "Digite a quantidade do lote inteiro, já limpa. Dá para usar kg ou g."}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Embalagem</h2>
        {renderItems("portion")}
        {canWrite ? (
          <AddItem recipeId={recipe.id} options={available("embalagem")} defaultQty="1" label="Escolha a embalagem" field="Embalagem" title="Adicionar embalagem" lockUnit onAdded={(item) => setItems((prev) => [...prev, item])} />
        ) : null}
      </section>

      <details className="card">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">Detalhes (opcional)</summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Código do produto
            <input value={code} onChange={(e) => setCode(e.target.value)} onBlur={saveDetails} disabled={!canWrite} maxLength={40} placeholder="Ex.: 100" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Observação sobre a porção
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveDetails}
              disabled={!canWrite}
              maxLength={200}
              rows={2}
              placeholder="Ex.: porção de 300 g, embalagem de 750 ml"
              className="rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
          </label>
        </div>
      </details>

      {isServing ? null : (
        <details open className="card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">Quantas unidades saem do lote</summary>
          <div className="flex flex-col gap-4 border-t border-border p-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Quantas unidades essa receita rende?
              <input value={portions} onChange={(e) => setPortions(e.target.value)} onBlur={() => saveSettings()} inputMode="decimal" disabled={!canWrite} className={inputClass} />
            </label>
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">Mais opções (peso e perda no cozimento)</summary>
              <div className="flex flex-col gap-4 pt-3">
                <div className="flex flex-col gap-1.5 text-sm font-medium">
                  <label htmlFor="portion-weight">Peso de cada unidade pronta</label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <input id="portion-weight" value={portionWeight} onChange={(e) => setPortionWeight(e.target.value)} onBlur={() => saveSettings()} inputMode="decimal" disabled={!canWrite} className={inputClass} />
                    <UnitSelect value={weightUnit} options={["g"]} onChange={(u) => changeWeightUnit(u as "g" | "kg")} disabled={!canWrite} label="Unidade do peso" />
                  </div>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  <span>
                    Perda no cozimento (%)
                    <Hint>Quanto a comida perde de peso ao cozinhar. Serve para calcular quantas unidades saem quando você informa o peso de cada uma.</Hint>
                  </span>
                  <input value={cookingLoss} onChange={(e) => setCookingLoss(e.target.value)} onBlur={() => saveSettings()} inputMode="decimal" disabled={!canWrite} className={inputClass} />
                </label>
              </div>
            </details>
          </div>
        </details>
      )}

      <button type="button" onClick={finish} className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">
        Voltar às fichas
      </button>
    </div>
  );
}
