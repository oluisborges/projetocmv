"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { D, fromBaseQty, toBaseQty, type PurchaseUnit } from "@/lib/calc";
import { Hint } from "@/components/hint";
import { Spinner } from "@/components/spinner";
import { formatBRL, formatNumber, parseDecimal } from "@/lib/format";
import { computeReceita } from "@/lib/recipe-cost";
import { removeRecipeItem, updateRecipeSettings } from "@/app/(app)/cardapio/actions";
import { AddItem, ItemRow, type EditorIngredient, type EditorItem } from "@/app/(app)/cardapio/[id]/recipe-editor";

const inputClass = "h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(Number(n.toFixed(4))).replace(".", ","));

type Props = {
  recipe: { id: string; name: string; readyWeightGrams: number | null; readyWeightUnit: ReadyUnit };
  initialItems: EditorItem[];
  ingredients: EditorIngredient[];
  canWrite: boolean;
};

/**
 * Editor de uma Receita (arroz, estrogonofe…): o lote inteiro com o que entra e o peso total que rende pronto.
 * O custo por kg sai daqui e é o que as marmitas pagam por grama usado.
 */
type ReadyUnit = "g" | "kg" | "ml" | "l" | "un";

export function ReceitaEditor({ recipe, initialItems, ingredients, canWrite }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState(recipe.name);
  const [unit, setUnit] = useState<ReadyUnit>(recipe.readyWeightUnit);
  const [ready, setReady] = useState(recipe.readyWeightGrams === null ? "" : fmt(fromBaseQty(recipe.readyWeightGrams, recipe.readyWeightUnit).toNumber()));
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [ingList, setIngList] = useState(ingredients);
  const byId = useMemo(() => new Map(ingList.map((i) => [i.id, i])), [ingList]);

  const readyGrams = useMemo(() => {
    const p = parseDecimal(ready);
    return p === null ? null : toBaseQty(Number(p), unit).toNumber();
  }, [ready, unit]);

  const perLabel = unit === "un" ? "Custo por unidade pronta" : unit === "ml" || unit === "l" ? "Custo por litro pronto" : "Custo por kg pronto";
  const cost = useMemo(
    () => computeReceita({ readyWeightGrams: readyGrams, ingredients: items.flatMap((i) => (byId.has(i.ingredientId) ? [{ ingredient: byId.get(i.ingredientId)!, netQty: i.netQty }] : [])) }),
    [items, readyGrams, byId],
  );

  async function save(over: { ready?: string; unit?: ReadyUnit } = {}): Promise<boolean> {
    setStatus({ kind: "saving" });
    const result = await updateRecipeSettings({ id: recipe.id, name, portions: "1", portionWeight: over.ready ?? ready, portionWeightUnit: over.unit ?? unit, cookingLoss: "0" });
    if (result.ok) {
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
      router.refresh();
      return true;
    }
    setStatus({ kind: "error", message: result.error });
    return false;
  }

  const emptyDialog = useRef<HTMLDialogElement>(null);

  async function leave() {
    if (canWrite && !(await save())) return;
    router.push("/ingredientes?aba=receitas");
  }

  // Receita sem ingrediente ou sem o peso que rende: confirma antes de concluir (o custo por kg fica incompleto).
  function finish() {
    if (canWrite && !cost) emptyDialog.current?.showModal();
    else void leave();
  }

  // Trocar kg/g não muda o peso: 12,5 kg vira 12.500 g.
  function changeUnit(next: ReadyUnit) {
    const p = parseDecimal(ready);
    const converted = p === null ? ready : fmt(fromBaseQty(toBaseQty(Number(p), unit), next).toNumber());
    setReady(converted);
    setUnit(next);
    void save({ ready: converted, unit: next });
  }

  const removeItem = async (item: EditorItem) => {
    const result = await removeRecipeItem(item.id);
    if (result.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    else setStatus({ kind: "error", message: result.error });
  };

  const usedIds = new Set(items.map((i) => i.ingredientId));
  const options = ingList.filter((i) => !i.archived && !usedIds.has(i.id));
  const rows = items.filter((i) => byId.has(i.ingredientId));
  const savedChip =
    status.kind === "saving" ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Spinner className="size-3" />
        Salvando…
      </span>
    ) : status.kind === "saved" ? (
      <span className="text-xs text-success">Salvo ✓</span>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-live="polite" className="sticky top-[var(--sticky-top)] z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        {cost ? (
          <div className="flex flex-col gap-0.5">
            <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
              <span>
                {perLabel}
                <Hint>O custo do lote inteiro (com sal, tempero e tudo) dividido pelo que sai pronto. A marmita paga só o que usa.</Hint>
              </span>
              {savedChip}
            </p>
            <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(cost.costPerGram * (unit === "un" ? 1 : 1000))}</p>
            <p className="tabular text-xs text-muted">
              Lote {formatBRL(cost.batchCost)} · rende {unit === "un" ? `${formatNumber(cost.readyWeightGrams, 0)} un` : `${formatNumber(cost.readyWeightGrams / 1000, 2)} ${unit === "ml" || unit === "l" ? "L" : "kg"}`}{unit === "un" ? "" : ` · ${formatBRL(cost.costPerGram * 100)} a cada 100 ${unit === "ml" || unit === "l" ? "ml" : "g"}`}
            </p>
            {cost.missingPrices > 0 ? (
              <p className="pt-1 text-xs text-warning">
                {cost.missingPrices} {cost.missingPrices === 1 ? "item sem preço" : "itens sem preço"}: o custo está incompleto. Preencha em Ingredientes.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">{rows.length === 0 ? "Adicione os ingredientes do lote para ver o custo." : "Informe quanto o lote rende pronto para ver o custo por kg."}</p>
            {savedChip}
          </div>
        )}
        {status.kind === "error" ? (
          <p role="alert" className="pt-1 text-sm text-danger">
            {status.message}
          </p>
        ) : null}
      </section>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => save()} disabled={!canWrite} className={inputClass} />
      </label>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Ingredientes do lote
          <Hint>Tudo que entra no lote, com o sal, a cebola e o tempero. Digite a quantidade do lote inteiro, já limpa (sem casca nem osso).</Hint>
        </h2>
        {rows.length > 0 ? (
          <ul className="divide-y divide-border card px-4">
            {rows.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                ingredient={byId.get(item.ingredientId)!}
                canWrite={canWrite}
                perPortion={false}
                lockUnit={false}
                yieldFactor={1}
                onChange={(qty, u: PurchaseUnit) => setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, netQty: qty, unit: u } : i)))}
                onRemove={() => removeItem(item)}
                onPriceSaved={(price) =>
                  setIngList((prev) => prev.map((i) => (i.id === item.ingredientId ? { ...i, purchase_price: price, unit_cost: D(price).div(toBaseQty(i.purchase_qty, i.purchase_unit as PurchaseUnit)).toNumber() } : i)))
                }
              />
            ))}
          </ul>
        ) : null}
        {canWrite ? (
          <AddItem
            recipeId={recipe.id}
            kind="insumo"
            options={options}
            defaultQty=""
            label="Escolha o ingrediente"
            field="Ingrediente"
            title="Adicionar ingrediente"
            lockUnit={false}
            onCreated={(ing) => setIngList((prev) => [...prev, ing])}
            onAdded={(item) => setItems((prev) => [...prev, item])}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Quanto rende pronta</h2>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <label htmlFor="ready-weight">
            Quanto rende depois de pronta
            <Hint>Pese (ou meça) o lote pronto uma vez e anote. Se 5 kg de arroz cru viram 12,5 kg de arroz cozido, digite 12,5 kg. Para molhos e caldos, pode usar litros ou ml ou unidades (ex.: 30 pães).</Hint>
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input id="ready-weight" value={ready} onChange={(e) => setReady(e.target.value)} onBlur={() => save()} inputMode="decimal" disabled={!canWrite} className={inputClass} />
            <select value={unit} onChange={(e) => changeUnit(e.target.value as ReadyUnit)} disabled={!canWrite} aria-label="Unidade do peso" className="h-12 card px-3 text-base outline-none focus:border-primary disabled:opacity-60">
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="l">litros</option>
              <option value="ml">ml</option>
              <option value="un">un</option>
            </select>
          </div>
        </div>
      </section>

      <button type="button" onClick={finish} className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground">
        Concluído
      </button>

      <dialog
        ref={emptyDialog}
        aria-labelledby="empty-receita-title"
        onClick={(e) => e.target === emptyDialog.current && emptyDialog.current?.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 id="empty-receita-title" className="text-lg font-extrabold">
              Concluir assim mesmo?
            </h2>
            <p className="text-sm leading-relaxed text-muted">
              {rows.length === 0 ? "Esta receita está sem nenhum ingrediente." : "Falta informar quanto a receita rende pronta."} Sem isso, ela não tem custo por kg e as marmitas que a usam ficam incompletas. Dá para voltar e completar depois.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => emptyDialog.current?.close()} className="h-12 card font-semibold">
              Voltar e completar
            </button>
            <button
              type="button"
              onClick={() => {
                emptyDialog.current?.close();
                void leave();
              }}
              className="h-12 rounded-xl bg-primary font-semibold text-white"
            >
              Concluir
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
