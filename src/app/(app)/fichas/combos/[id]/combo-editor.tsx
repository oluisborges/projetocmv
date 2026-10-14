"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EstimateNotice } from "@/components/estimate-notice";
import { Hint } from "@/components/hint";
import { MarginBadge } from "@/components/margin-badge";
import { summarizeCombo } from "@/lib/combo-view";
import type { ComboGroupRow, ComboOptionRow, RecipeCostInfo } from "@/lib/combos-data";
import { formatBRL, formatNumber, formatPct } from "@/lib/format";
import { analyzePrice, type PricingSettings } from "@/lib/pricing-view";
import { addGroup, addOption, deleteGroup, removeOption, renameCombo, updateGroup, updateOption } from "../actions";

const inputClass = "h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const small = "tabular h-11 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";
const money = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  combo: { id: string; name: string };
  initialGroups: ComboGroupRow[];
  recipes: RecipeCostInfo[];
  weights: Record<string, number>;
  settings: PricingSettings;
  feePct: number;
  estimateReason: "tax" | "expenses" | null;
  canWrite: boolean;
};

/** Escolhe uma marmita (que ainda não está no grupo) e a coloca no grupo. */
function AddOption({ group, recipes, onAdded, disabled }: { group: ComboGroupRow; recipes: RecipeCostInfo[]; onAdded: (o: ComboOptionRow) => void; disabled: boolean }) {
  const [recipeId, setRecipeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const used = new Set(group.options.map((o) => o.recipe_id));
  const available = recipes.filter((r) => !used.has(r.id));

  async function add() {
    if (!recipeId) return setError("Escolha a marmita.");
    setBusy(true);
    const result = await addOption({ groupId: group.id, recipeId });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onAdded(result.option);
    setRecipeId("");
    setError(undefined);
  }

  if (available.length === 0) {
    return <p className="text-xs text-muted">Todas as suas marmitas já estão neste grupo.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <span className="relative">
          <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} disabled={disabled} aria-label="Marmita para adicionar" className={`${inputClass} w-full appearance-none pr-10 ${recipeId ? "" : "text-muted"}`}>
            <option value="" disabled hidden>
              Escolha a marmita
            </option>
            {available.map((r) => (
              <option key={r.id} value={r.id} className="text-foreground">
                {r.name}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted">
            ▾
          </span>
        </span>
        <button type="button" onClick={add} disabled={busy || disabled} className="h-12 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "…" : "Adicionar"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Linha de uma marmita num grupo FIXO: quantas unidades e quanto cada uma sai dentro do combo. */
function FixedOptionRow({ option, recipe, canWrite, onChange, onRemove }: { option: ComboOptionRow; recipe: RecipeCostInfo | undefined; canWrite: boolean; onChange: (o: ComboOptionRow) => void; onRemove: () => void }) {
  const [qty, setQty] = useState(String(option.qty ?? 1));
  const [price, setPrice] = useState(money.format(option.unit_price ?? 0));
  const [error, setError] = useState<string>();

  async function save(field: "qty" | "unitPrice", value: string) {
    const result = await updateOption({ optionId: option.id, [field]: value });
    if (!result.ok) return setError(result.error);
    setError(undefined);
    setQty(String(result.qty ?? 1));
    setPrice(money.format(result.unit_price ?? 0));
    onChange({ ...option, qty: result.qty, unit_price: result.unit_price });
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-2 font-medium leading-snug">{recipe?.name ?? "Marmita arquivada"}</p>
          <p className="text-xs text-muted">
            {recipe ? (recipe.cost === null ? <span className="text-warning">sem custo</span> : `custa ${formatBRL(recipe.cost)}`) : <span className="text-warning">volte a ativar a ficha</span>}
            {recipe?.price ? ` · avulsa ${formatBRL(recipe.price)}` : ""}
          </p>
        </div>
        {canWrite ? (
          <button type="button" onClick={onRemove} aria-label="Remover marmita do grupo" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-muted active:bg-background">
            ×
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Quantas
          <input value={qty} onChange={(e) => setQty(e.target.value)} onBlur={() => qty.trim() !== String(option.qty ?? 1) && void save("qty", qty)} inputMode="numeric" disabled={!canWrite} className={small} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Cada uma sai por (R$)
          <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => price.trim() !== money.format(option.unit_price ?? 0) && void save("unitPrice", price)} inputMode="decimal" disabled={!canWrite} className={small} />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function GroupCard({ group, recipes, canWrite, onChange, onDelete }: { group: ComboGroupRow; recipes: RecipeCostInfo[]; canWrite: boolean; onChange: (g: ComboGroupRow) => void; onDelete: () => void }) {
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const [name, setName] = useState(group.name);
  const [pick, setPick] = useState(String(group.pick_qty ?? 1));
  const [price, setPrice] = useState(money.format(group.unit_price ?? 0));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const choice = group.kind === "choice";

  async function save(patch: { name?: string; pickQty?: string; unitPrice?: string }) {
    const result = await updateGroup({ groupId: group.id, ...patch });
    if (!result.ok) return setError(result.error);
    setError(undefined);
    setName(result.name);
    setPick(String(result.pick_qty ?? 1));
    setPrice(money.format(result.unit_price ?? 0));
    onChange({ ...group, name: result.name, pick_qty: result.pick_qty, unit_price: result.unit_price });
  }

  async function dropOption(o: ComboOptionRow) {
    const result = await removeOption(o.id);
    if (!result.ok) return setError(result.error);
    onChange({ ...group, options: group.options.filter((x) => x.id !== o.id) });
  }

  return (
    <section className="flex flex-col gap-3 card p-4" aria-label={group.name}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${choice ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"}`}>
            {choice ? "O cliente escolhe" : "Marmitas fixas"}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== group.name && void save({ name })}
            disabled={!canWrite}
            aria-label="Nome do grupo"
            className="mt-1.5 h-11 w-full bg-transparent text-lg font-extrabold outline-none focus:underline"
          />
        </div>
        {canWrite ? (
          confirming ? (
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={onDelete} className="h-11 rounded-xl bg-danger px-3 text-sm font-semibold text-white">
                Remover
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-border px-3 text-sm font-semibold">
                Não
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="h-11 shrink-0 px-2 text-sm font-semibold text-danger">
              Remover grupo
            </button>
          )
        ) : null}
      </div>

      {choice ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Quantas marmitas o cliente escolhe
            <input value={pick} onChange={(e) => setPick(e.target.value)} onBlur={() => pick.trim() !== String(group.pick_qty ?? 1) && void save({ pickQty: pick })} inputMode="numeric" disabled={!canWrite} className={small} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Cada uma sai por (R$)
            <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => price.trim() !== money.format(group.unit_price ?? 0) && void save({ unitPrice: price })} inputMode="decimal" disabled={!canWrite} className={small} />
          </label>
        </div>
      ) : null}

      {group.options.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border px-3">
          {group.options.map((o) =>
            choice ? (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{byId.get(o.recipe_id)?.name ?? "Marmita arquivada"}</p>
                  <p className="text-xs text-muted">
                    {byId.get(o.recipe_id)?.cost == null ? <span className="text-warning">sem custo</span> : `custa ${formatBRL(byId.get(o.recipe_id)!.cost!)}`}
                  </p>
                </div>
                {canWrite ? (
                  <button type="button" onClick={() => void dropOption(o)} aria-label="Remover opção" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl text-muted active:bg-background">
                    ×
                  </button>
                ) : null}
              </li>
            ) : (
              <FixedOptionRow
                key={o.id}
                option={o}
                recipe={byId.get(o.recipe_id)}
                canWrite={canWrite}
                onChange={(next) => onChange({ ...group, options: group.options.map((x) => (x.id === next.id ? next : x)) })}
                onRemove={() => void dropOption(o)}
              />
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted">{choice ? "Adicione as marmitas que o cliente pode escolher." : "Adicione as marmitas que vêm sempre neste combo."}</p>
      )}

      {canWrite ? <AddOption group={group} recipes={recipes} disabled={!canWrite} onAdded={(o) => onChange({ ...group, options: [...group.options, o] })} /> : null}

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function ComboEditor({ combo, initialGroups, recipes, weights, settings, feePct, estimateReason, canWrite }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [name, setName] = useState(combo.name);
  const [status, setStatus] = useState<{ kind: "idle" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();

  const recipeMap = useMemo(() => new Map(recipes.map((r) => [r.id, { cost: r.cost }])), [recipes]);
  const weightMap = useMemo(() => new Map(Object.entries(weights)), [weights]);

  const summary = useMemo(
    () => summarizeCombo({ groups: groups.map((g) => ({ kind: g.kind, pick_qty: g.pick_qty, unit_price: g.unit_price, options: g.options })) }, recipeMap, weightMap, settings, feePct),
    [groups, recipeMap, weightMap, settings, feePct],
  );
  const at = summary.analysis?.at;
  const worst = summary.hasChoice && summary.costMax > summary.costMin && summary.price > 0 ? analyzePrice({ cost: summary.costMax, settings, feePct, price: summary.price }).at : null;

  async function rename() {
    if (name.trim() === combo.name) return;
    const result = await renameCombo(combo.id, name);
    if (result.ok) {
      setStatus({ kind: "saved" });
      setTimeout(() => setStatus({ kind: "idle" }), 2000);
    } else {
      setStatus({ kind: "error", message: result.error });
    }
  }

  async function newGroup(kind: "fixed" | "choice") {
    setAdding(false);
    const result = await addGroup({ comboId: combo.id, kind });
    if (!result.ok) return setError(result.error);
    setError(undefined);
    setGroups((prev) => [...prev, result.group]);
  }

  async function dropGroup(id: string) {
    const result = await deleteGroup(id);
    if (!result.ok) return setError(result.error);
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-live="polite" className="sticky top-16 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        {summary.empty ? (
          <p className="text-sm text-muted">Adicione as marmitas do combo para ver o preço e o lucro.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Preço do combo</p>
              {status.kind === "saved" ? <span className="text-xs text-success">Salvo ✓</span> : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="tabular text-3xl font-extrabold tracking-tight">{formatBRL(summary.price)}</p>
              {at ? <MarginBadge status={at.status} pct={at.netPct} estimate={estimateReason !== null} /> : null}
            </div>
            <p className="tabular text-xs text-muted">
              {formatNumber(summary.units, 0)} {summary.units === 1 ? "marmita" : "marmitas"} · {summary.pricePerUnit !== null ? `${formatBRL(summary.pricePerUnit)} cada, em média` : ""} · custa {formatBRL(summary.cost)}
              {summary.hasChoice ? (
                <Hint label="Como o custo é calculado?">
                  Nos grupos em que o cliente escolhe, o custo é a média das marmitas, dando mais peso às que mais vendem (sem vendas, todas valem igual). O pior caso supõe que o cliente leve sempre as mais caras.
                </Hint>
              ) : null}
            </p>
            {at ? (
              <p className="tabular text-xs text-muted">
                Depois de tudo, {at.net >= 0 ? "sobra" : "falta"} <strong className="text-foreground">{formatBRL(Math.abs(at.net))}</strong> por combo
                {worst ? ` · no pior caso, ${formatPct(worst.netPct)}` : ""}
              </p>
            ) : null}
            {summary.incomplete ? <p className="text-xs text-warning">Alguma marmita está sem custo (ficha incompleta ou arquivada): o custo está subestimado.</p> : null}
          </div>
        )}
      </section>

      <EstimateNotice reason={estimateReason} />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome do combo
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} disabled={!canWrite} className={inputClass} />
      </label>
      {status.kind === "error" ? (
        <p role="alert" className="-mt-3 text-sm text-danger">
          {status.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <GroupCard
            key={g.id}
            group={g}
            recipes={recipes}
            canWrite={canWrite}
            onChange={(next) => setGroups((prev) => prev.map((x) => (x.id === next.id ? next : x)))}
            onDelete={() => void dropGroup(g.id)}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {canWrite ? (
        adding ? (
          <div className="flex flex-col gap-2 card p-3">
            <p className="text-sm font-semibold">Que tipo de grupo?</p>
            <button type="button" onClick={() => void newGroup("fixed")} className="flex flex-col items-start gap-0.5 rounded-xl border border-border px-4 py-3 text-left active:bg-background">
              <span className="font-semibold">Marmitas fixas</span>
              <span className="text-xs text-muted">Vem sempre igual: por exemplo, 5 do mesmo sabor ou uma lista de sabores com quantidade.</span>
            </button>
            <button type="button" onClick={() => void newGroup("choice")} className="flex flex-col items-start gap-0.5 rounded-xl border border-border px-4 py-3 text-left active:bg-background">
              <span className="font-semibold">O cliente escolhe</span>
              <span className="text-xs text-muted">Por exemplo, &quot;escolha 10 entre estes sabores&quot;, com o mesmo preço para cada marmita.</span>
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-11 text-sm font-semibold text-muted">
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="h-12 rounded-xl border border-dashed border-primary text-sm font-semibold text-primary">
            + Adicionar grupo de marmitas
          </button>
        )
      ) : null}

      {recipes.length === 0 ? (
        <p className="text-sm text-muted">
          Você ainda não tem marmitas. Crie em <Link href="/fichas/nova" className="font-semibold text-primary underline">Fichas → Nova ficha</Link>.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Falta uma marmita na lista? <Link href="/fichas/nova" className="font-semibold text-primary underline">Crie a ficha dela</Link> e volte aqui.
        </p>
      )}
    </div>
  );
}
