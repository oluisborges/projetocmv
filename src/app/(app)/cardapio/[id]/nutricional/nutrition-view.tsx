"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { NUTRIENT_KEYS, roundForLabel, type NutrientKey, type Nutrition } from "@/lib/calc/nutrition";
import type { NutritionLine } from "@/lib/nutrition-data";
import { ROWS, type NutritionRowView } from "@/lib/nutrition-rows";
import { searchTaco } from "@/lib/taco";
import { resetNutritionOverride, saveNutritionOverride, saveTacoLink } from "./actions";

type Props = {
  recipeId: string;
  rows: NutritionRowView[];
  perPortion: Nutrition;
  portionGrams: number | null;
  householdMeasure: string;
  lines: NutritionLine[];
  missing: number;
  hasOverride: boolean;
  /** Nutrientes que o cliente já corrigiu antes. */
  overriddenKeys: NutrientKey[];
  canWrite: boolean;
};

const SOURCE_LABEL = { salvo: "escolhido", sugerido: "sugerido: confira", sem: "sem correspondência" } as const;
const SOURCE_STYLE = { salvo: "bg-primary/10 text-primary", sugerido: "bg-warning/10 text-warning", sem: "bg-danger/10 text-danger" } as const;
const inputClass = "h-11 w-full rounded-lg border border-border bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const fmtInput = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

/** Tabela nutricional pronta para baixar, imprimir ou corrigir, e a origem de cada número (ingrediente → alimento da TACO). */
export function NutritionView({ recipeId, rows, perPortion, portionGrams, householdMeasure, lines, missing, hasOverride, overriddenKeys, canWrite }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState<NutritionLine | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [grams, setGrams] = useState("");
  const [measure, setMeasure] = useState("");

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      after?.();
      router.refresh();
    });

  const openEdit = () => {
    const start = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, fmtInput(roundForLabel(k, perPortion[k]))]));
    setVals(start);
    setInitial(start);
    setGrams(fmtInput(portionGrams));
    setMeasure(householdMeasure);
    setError(null);
    setEditing(true);
  };

  // Só vira correção o que a pessoa mexeu (ou o que já era correção antes); o resto continua automático.
  const changedOnly = () => Object.fromEntries(Object.entries(vals).filter(([k, v]) => v !== initial[k] || overriddenKeys.includes(k as NutrientKey)));

  const portion = portionGrams ? `${portionGrams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g` : "—";

  return (
    <>
      <style>{`@media print { body * { visibility: hidden !important; } #nutri-print, #nutri-print * { visibility: visible !important; } #nutri-print { position: absolute; left: 0; top: 0; width: 100%; max-width: 420px; box-shadow: none !important; border: 0 !important; } }`}</style>

      <p className="rounded-xl bg-warning/10 p-3 text-sm leading-snug text-warning">
        <strong>Tabela criada automaticamente</strong> a partir dos ingredientes e receitas do produto, com base na Tabela Brasileira de Composição de Alimentos (TACO, 4ª edição, NEPA/Unicamp) e no formato da RDC 429/2020 e da IN 75/2020 (Anvisa).{" "}
        <strong>A conferência e a validação dos valores antes da utilização no rótulo são de responsabilidade do usuário.</strong>
      </p>

      {missing > 0 ? (
        <p className="text-sm text-warning">
          {missing} {missing === 1 ? "ingrediente ficou" : "ingredientes ficaram"} fora da soma (sem alimento da TACO ou sem peso). Veja em &ldquo;De onde vêm os números&rdquo; e escolha o alimento certo.
        </p>
      ) : null}

      <section id="nutri-print" className="mx-auto w-full max-w-[440px] border-2 border-black bg-white p-3 text-black card">
        <h2 className="border-b border-black pb-1.5 text-xl font-extrabold leading-tight tracking-tight">INFORMAÇÃO NUTRICIONAL</h2>
        <p className="border-b-[6px] border-black py-1.5 text-[13px] leading-snug">
          Porções por embalagem: 1<br />
          Porção: <strong>{portion}</strong> ({householdMeasure})
        </p>
        <table className="w-full table-fixed border-collapse text-[13px]">
          <colgroup>
            <col />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-black text-right text-xs font-bold">
              <th className="py-1.5" />
              <th className="py-1.5 pl-1 font-bold">100 g</th>
              <th className="py-1.5 pl-1 font-bold">{portion}</th>
              <th className="py-1.5 pl-1 font-bold">%VD*</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-black/50 align-middle">
                <th scope="row" className={`py-2 pr-1 text-left ${r.indent ? "pl-3 font-normal" : "font-bold"}`}>
                  {r.label}
                </th>
                <td className="tabular py-2 pl-1 text-right leading-tight">
                  {r.per100}
                  {r.per100Sub ? <span className="block text-[11px] text-black/60">{r.per100Sub}</span> : null}
                </td>
                <td className="tabular py-2 pl-1 text-right leading-tight">
                  {r.perPortion}
                  {r.perPortionSub ? <span className="block text-[11px] text-black/60">{r.perPortionSub}</span> : null}
                </td>
                <td className="tabular py-2 pl-1 text-right font-semibold">{r.vd}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] leading-snug">*Percentual de valores diários fornecidos pela porção, com base em uma dieta de 2.000 kcal ou 8.400 kJ. Seus valores diários podem ser maiores ou menores, dependendo de suas necessidades energéticas. **%VD não estabelecido.</p>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <a href={`/cardapio/${recipeId}/nutricional/baixar`} download className="flex h-12 items-center justify-center rounded-xl border border-primary bg-primary text-sm font-semibold text-primary-foreground">
          Baixar PDF
        </a>
        <button type="button" onClick={() => window.print()} className="h-12 rounded-xl border border-border bg-surface text-sm font-semibold">
          Imprimir
        </button>
        {canWrite ? (
          <button type="button" onClick={openEdit} className="col-span-2 h-12 rounded-xl border border-border bg-surface text-sm font-semibold">
            Alterar valores{hasOverride ? " (há valores alterados)" : ""}
          </button>
        ) : null}
      </div>

      {editing ? (
        <section className="flex flex-col gap-3 card p-4">
          <div>
            <h2 className="font-semibold">Alterar valores</h2>
            <p className="text-sm text-muted">Digite o valor de uma porção. O que você não mexer continua automático. Os números por 100 g e o %VD são refeitos sozinhos.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Peso da porção (g)
              <input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Medida caseira
              <input value={measure} onChange={(e) => setMeasure(e.target.value)} maxLength={60} placeholder="1 marmita" className={inputClass} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ROWS.map((r) => (
              <label key={r.key} className="flex flex-col gap-1 text-sm font-medium">
                {r.label} ({r.unit})
                <input inputMode="decimal" value={vals[r.key] ?? ""} onChange={(e) => setVals({ ...vals, [r.key]: e.target.value })} className={inputClass} />
              </label>
            ))}
          </div>
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-12 rounded-xl border border-border bg-surface text-sm font-semibold">
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => saveNutritionOverride({ recipeId, values: changedOnly(),  portionGrams: grams, householdMeasure: measure }), () => setEditing(false))}
              className="h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
          {hasOverride ? (
            <button type="button" disabled={pending} onClick={() => run(() => resetNutritionOverride(recipeId), () => setEditing(false))} className="h-11 text-sm font-semibold text-danger">
              Voltar ao automático
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">De onde vêm os números</h2>
        <ul className="flex flex-col divide-y divide-border card px-4">
          {lines.map((l) => (
            <li key={l.ingredientId} className="flex flex-col gap-1 py-3">
              <LineInfo l={l} canWrite={canWrite} onPick={setPicking} />
              {l.kind === "receita" ? (
                <div className="mt-1 flex flex-col gap-1 border-l-2 border-primary/30 pl-3">
                  <p className="text-xs text-muted">Receita: a soma dos ingredientes dela, pelo peso que ela rende. As quantidades abaixo são as do lote.</p>
                  {(l.children ?? []).length === 0 ? <p className="text-xs text-muted">Esta receita ainda não tem ingredientes.</p> : null}
                  <ul className="flex flex-col divide-y divide-border/60">
                    {(l.children ?? []).map((c) => (
                      <li key={c.ingredientId} className="flex flex-col gap-1 py-2">
                        <LineInfo l={c} canWrite={canWrite} onPick={setPicking} compact />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Valores por 100 g do alimento como descrito na TACO (cru, cozido…). Ingredientes em ml contam como g. Embalagens ficam de fora. A TACO não traz açúcares: se o seu produto os tem, use &ldquo;Alterar valores&rdquo;.</p>
      </section>

      {picking ? (
        <TacoPicker
          line={picking}
          pending={pending}
          error={error}
          onClose={() => setPicking(null)}
          onPick={(tacoId) => run(() => saveTacoLink({ recipeId, ingredientId: picking.ingredientId, tacoId }), () => setPicking(null))}
        />
      ) : null}
    </>
  );
}

/** Uma linha de "De onde vêm os números": o ingrediente, quanto entra e o alimento da TACO ligado (com o botão de trocar). */
function LineInfo({ l, canWrite, onPick, compact = false }: { l: NutritionLine; canWrite: boolean; onPick: (l: NutritionLine) => void; compact?: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`min-w-0 ${compact ? "text-sm font-medium" : "font-semibold"}`}>{l.name}</span>
        <span className="tabular shrink-0 text-xs text-muted">= {l.grams === null ? "sem peso (unidade)" : `${l.grams.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} g`}</span>
      </div>
      {l.kind === "receita" ? null : (
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-xs text-muted">{l.tacoName ?? "Nenhum alimento da TACO ligado"}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_STYLE[l.source]}`}>{SOURCE_LABEL[l.source]}</span>
        </div>
      )}
      {l.lacksEnergy ? <p className="text-xs text-warning">A TACO não traz a energia deste alimento: troque por outro parecido.</p> : null}
      {l.kind === "insumo" && canWrite ? (
        <button type="button" onClick={() => onPick(l)} className="tap-area self-start text-sm font-semibold text-primary">
          {l.tacoId === null ? "Escolher alimento" : "Trocar alimento"}
        </button>
      ) : null}
    </>
  );
}

/** Janela de busca para escolher o alimento da TACO de um ingrediente. */
function TacoPicker({ line, pending, error, onClose, onPick }: { line: NutritionLine; pending: boolean; error: string | null; onClose: () => void; onPick: (id: number) => void }) {
  const [q, setQ] = useState(line.name);
  const results = useMemo(() => searchTaco(q), [q]);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 lg:items-center lg:p-4" role="dialog" aria-modal="true" aria-label="Escolher alimento da TACO" onClick={onClose}>
      <div className="flex h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface lg:h-[80dvh] lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-border py-1 pl-4 pr-1">
          <div className="min-w-0">
            <p className="font-extrabold leading-tight">Alimento da TACO</p>
            <p className="truncate text-xs text-muted">Para: {line.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 place-items-center rounded-full text-xl text-muted">
            ✕
          </button>
        </div>
        <div className="p-3">
          <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: ex. frango grelhado" aria-label="Buscar alimento" className={inputClass} />
          {error ? <p className="mt-2 text-sm font-semibold text-danger">{error}</p> : null}
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-3 pb-3">
          {results.length === 0 ? <li className="py-4 text-sm text-muted">Nenhum alimento encontrado. Tente uma palavra só.</li> : null}
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" disabled={pending} onClick={() => onPick(f.id)} className="flex min-h-12 w-full flex-col items-start justify-center py-2 text-left disabled:opacity-60">
                <span className="text-sm font-semibold">{f.name}</span>
                <span className="text-xs text-muted">{f.category}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export type { NutrientKey };
