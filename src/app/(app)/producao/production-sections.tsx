"use client";

import { copyText } from "@/lib/copy-text";
import { useState } from "react";
import { Hint } from "@/components/hint";
import { ShareMenu } from "@/components/share-menu";
import { baseUnitOf, isPurchaseUnit } from "@/lib/calc";
import { formatBRL, formatBaseQty, formatNumber } from "@/lib/format";
import { parsePaid, parsePurchaseQty, qtyToField } from "@/lib/purchase-qty";
import { batchesLabel, groupBySupplier, shoppingText, type BuyRow, type ProductionCalc, type ProductionInput } from "@/lib/production-view";
import { updateIngredientPrice } from "../ingredientes/actions";
import { setBought, savePurchase } from "./actions";

const noteClass = "text-xs leading-relaxed text-muted";

/** Passo "O que preparar": as receitas em lote que as marmitas usam, e quantos lotes fazer. */
export function PrepareList({ calc, receitas }: { calc: ProductionCalc; receitas: ProductionInput["receitas"] }) {
  if (calc.needs.receitas.size === 0) {
    return <p className="card p-4 text-sm text-muted">Nenhuma receita em lote nesta produção. Pode ir direto para as compras.</p>;
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
        Receitas para preparar
        <Hint>As receitas em lote (arroz, estrogonofe…) que as marmitas usam: quanto precisa ficar pronto e quantos lotes isso dá. Os insumos delas já estão na lista de compras.</Hint>
      </h2>
      <ul className="flex flex-col divide-y divide-border card px-4">
        {[...calc.needs.receitas].map(([id, r]) => {
          const bp = receitas[id];
          const whole = r.wholeBatches;
          return (
            <li key={id} className="flex flex-col gap-1 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{bp?.name ?? "Receita"}</span>
                <span className="tabular shrink-0 font-extrabold">{formatBaseQty(r.grams, bp?.base ?? "g")} prontos</span>
              </div>
              <p className="text-sm">
                {whole > 0 ? (
                  <>
                    Faça <strong>{whole} {whole === 1 ? "lote" : "lotes"}</strong>
                    {bp ? ` (cada um rende ${formatBaseQty(bp.readyGrams, bp.base)})` : ""}.
                  </>
                ) : (
                  "Informe quanto a receita rende pronta para calcular os lotes."
                )}
              </p>
              {r.batches > 0 && whole > r.batches + 0.005 ? <p className={noteClass}>Precisa de {batchesLabel(r.batches)}; a sobra serve para outro dia.</p> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Depois de marcar "comprei": quanto comprou de verdade e quanto pagou (quase sempre difere da lista). */
function PurchaseField({ row, planId, savedQty, savedPaid, onSaved }: { row: BuyRow; planId: string; savedQty: number; savedPaid: number | null; onSaved: () => void }) {
  const [qty, setQty] = useState(() => qtyToField(savedQty > 0 ? savedQty : row.buyQty, row.unit));
  const [paid, setPaid] = useState(() => (savedPaid !== null ? String(savedPaid).replace(".", ",") : ""));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputClass = "tabular h-11 w-full rounded-xl border border-border bg-background px-3 text-right text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  const bought = parsePurchaseQty(qty, row.unit, row.unit);
  const paidValue = parsePaid(paid);
  // Preço por embalagem de compra: o que pagou ÷ quantas embalagens vieram de fato.
  const perPack = "qty" in bought && typeof paidValue === "number" && paidValue > 0 && row.packSize && row.packSize > 0 ? paidValue / (bought.qty / row.packSize) : null;
  const diff = "qty" in bought ? bought.qty - row.buyQty : 0;
  const base = isPurchaseUnit(row.unit) ? baseUnitOf(row.unit) : "g";

  async function save() {
    setBusy(true);
    setMsg(null);
    const result = await savePurchase({ planId, ingredientId: row.id, qty, unit: row.unit, paid });
    setBusy(false);
    if (result.ok) {
      setMsg({ ok: true, text: "Compra salva." });
      onSaved();
    } else setMsg({ ok: false, text: result.error });
  }

  async function updatePrice() {
    if (perPack === null) return;
    setBusy(true);
    const result = await updateIngredientPrice(row.id, String(Math.round(perPack * 100) / 100).replace(".", ","));
    setBusy(false);
    setMsg(result.ok ? { ok: true, text: `Preço do insumo atualizado para ${formatBRL(result.price)}.` } : { ok: false, text: result.error });
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-background p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Comprei ({row.unit})
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" aria-label={`Quanto comprou de ${row.name}`} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Paguei (R$)
          <input value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder="0,00" aria-label={`Quanto pagou em ${row.name}`} className={inputClass} />
        </label>
      </div>
      {"qty" in bought && Math.abs(diff) > 0.0001 ? (
        <p className={noteClass}>
          {diff > 0 ? `${formatBaseQty(diff, base)} a mais que a lista (${row.buy}). A diferença entra no estoque.` : `${formatBaseQty(-diff, base)} a menos que a lista (${row.buy}). O estoque recebe só o que você comprou.`}
        </p>
      ) : null}
      <button type="button" onClick={save} disabled={busy || !("qty" in bought) || paidValue === undefined} className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">
        Salvar compra
      </button>
      {perPack !== null ? (
        <button type="button" onClick={updatePrice} disabled={busy} className="min-h-11 rounded-xl border border-primary px-3 text-left text-sm font-semibold text-primary disabled:opacity-60">
          Atualizar o preço do insumo para {formatBRL(perPack)}
        </button>
      ) : null}
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={`text-xs font-semibold ${msg.ok ? "text-success" : "text-danger"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

function CheckRow({ row, planId, checked, disabled, savedQty, savedPaid, onSaved, onToggle }: { row: BuyRow; planId: string; checked: boolean; disabled: boolean; savedQty: number; savedPaid: number | null; onSaved: () => void; onToggle: (next: boolean) => void }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} aria-label={`Comprei ${row.name}`} className="mt-0.5 size-6 shrink-0 accent-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`font-medium leading-snug ${checked ? "text-muted line-through" : ""}`}>{row.name}</p>
            <p className={noteClass}>
              precisa {row.need}
              {row.minimum ? ` (inclui o mínimo de ${row.minimum})` : ""}
              {row.stock ? ` · tem ${row.stock}` : " · estoque não contado"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`tabular font-extrabold ${checked ? "text-muted line-through" : ""}`}>{row.buy}</p>
            {row.packs ? <p className={noteClass}>{row.packs}</p> : null}
          </div>
        </div>
        {checked && !disabled ? <PurchaseField row={row} planId={planId} savedQty={savedQty} savedPaid={savedPaid} onSaved={onSaved} /> : null}
      </div>
    </li>
  );
}

/**
 * Passo "O que comprar": a lista com caixinha. Marcar "comprei" dá entrada no estoque (e desmarcar desfaz),
 * então o estoque se atualiza sozinho enquanto a pessoa faz as compras.
 */
export function BuyChecklist({
  calc,
  planId,
  bought,
  qtyOf,
  savedQty,
  paidSaved,
  onSaved,
  onDownloadSheet,
  canWrite,
  title,
  onBoughtChange,
}: {
  calc: ProductionCalc;
  planId: string;
  /** Ids dos insumos já marcados como comprados. */
  bought: Set<string>;
  /** Quanto dar de entrada no estoque ao marcar (embalagens inteiras, na unidade-base). */
  qtyOf: (id: string) => number;
  /** O que já foi salvo como comprado (insumo -> unidade-base) e quanto foi pago (insumo -> R$). */
  savedQty: Record<string, number>;
  paidSaved: Record<string, number>;
  /** Depois de salvar a compra: recarrega os números da produção. */
  onSaved: () => void;
  /** Abre a janela de escolha da ficha de produção. */
  onDownloadSheet: () => void;
  canWrite: boolean;
  title: string;
  onBoughtChange: (id: string, next: boolean) => void;
}) {
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const rows = calc.rows.toBuy;
  const groups = groupBySupplier(rows);
  const done = rows.filter((r) => bought.has(r.id)).length;
  const text = shoppingText(title, rows.filter((r) => !bought.has(r.id)), rows.filter((r) => !bought.has(r.id)).reduce((s, r) => s + r.cost, 0));

  async function toggle(row: BuyRow, next: boolean) {
    setError(undefined);
    onBoughtChange(row.id, next);
    const result = await setBought({ planId, ingredientId: row.id, bought: next, qtyBase: qtyOf(row.id) });
    if (!result.ok) {
      onBoughtChange(row.id, !next);
      setError(result.error);
    }
  }

  async function copy() {
    if (await copyText(text)) {
      setManual(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Nenhum jeito de copiar sozinho funcionou: mostra a lista para tocar e copiar na mão.
      setManual(true);
    }
  }

  if (rows.length === 0) {
    return <p className="card p-4 text-sm text-success">Tudo que esta produção pede já está no estoque. Nada para comprar.</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Lista de compras
          <Hint>O que a produção pede menos o que você tem em estoque, em embalagens inteiras. Marque o que já comprou: o estoque recebe a compra sozinho.</Hint>
        </h2>
        <span className="tabular text-sm font-semibold">
          {done} de {rows.length}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / rows.length) * 100}%` }} />
      </div>

      {groups.map((g) => (
        <div key={g.supplier ?? "todos"} className="flex flex-col gap-1">
          {g.supplier ? <h3 className="text-sm font-bold">{g.supplier}</h3> : null}
          <ul className="flex flex-col divide-y divide-border card px-4">
            {g.rows.map((r) => (
              <CheckRow key={r.id} row={r} planId={planId} checked={bought.has(r.id)} disabled={!canWrite} savedQty={savedQty[r.id] ?? 0} savedPaid={paidSaved[r.id] ?? null} onSaved={onSaved} onToggle={(next) => toggle(r, next)} />
            ))}
          </ul>
        </div>
      ))}

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <p className="tabular text-sm text-muted">
        {done > 0 && done < rows.length ? (
          <>
            Falta comprar <strong className="text-foreground">{formatBRL(rows.filter((r) => !bought.has(r.id)).reduce((sum, r) => sum + r.cost, 0))}</strong> (lista toda: {formatBRL(calc.buyCost)}, em embalagens inteiras, pelo preço cadastrado)
          </>
        ) : (
          <>
            Compra estimada: <strong className="text-foreground">{formatBRL(calc.buyCost)}</strong> (embalagens inteiras, pelo preço cadastrado)
          </>
        )}
      </p>
      {manual ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-muted">Não consegui copiar sozinho neste aparelho. Toque na lista, selecione tudo e copie:</p>
          <textarea readOnly value={text} rows={8} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-xl border border-border bg-surface p-3 text-base" />
        </div>
      ) : null}
      <ShareMenu
        items={[
          { key: "copiar", label: copied ? "Copiado ✓" : "Copiar lista", onClick: copy },
          { key: "whatsapp", label: "Enviar no WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
          { key: "ficha", label: "Baixar ficha de produção", hint: "PDF, você escolhe o que entra", onClick: onDownloadSheet },
        ]}
      />

      {calc.rows.enough.length > 0 ? (
        <details className="card px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted">Já tem em estoque ({calc.rows.enough.length})</summary>
          <ul className="divide-y divide-border pb-1">
            {calc.rows.enough.map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span>{r.name}</span>
                <span className="tabular shrink-0 text-muted">
                  precisa {r.need} · tem {r.stock}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/** Resumo no topo dos passos 2 a 4: quantas marmitas e quanto custa produzir. */
export function ProductionSummary({ calc }: { calc: ProductionCalc }) {
  return (
    <p className="tabular rounded-xl bg-background px-4 py-3 text-sm">
      <strong>{formatNumber(calc.marmitas, 0)} marmitas</strong> · custo de produzir tudo {formatBRL(calc.cost)} ({formatBRL(calc.marmitas > 0 ? calc.cost / calc.marmitas : 0)} cada)
    </p>
  );
}
