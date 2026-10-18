"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Hint } from "@/components/hint";
import { PendingLabel } from "@/components/spinner";
import type { PurchaseUnit } from "@/lib/calc";
import { formatBRL, formatNumber, parseDecimal } from "@/lib/format";
import { classifyUnit, newPurchasePrice, nfeCostPerBase } from "@/lib/nfe-price";
import { applyNfe, previewNfe } from "./actions";
import type { NfeChoice, NfeIngredient, NfePreview, NfePreviewItem, NfePreviewNote } from "./types";

type Pick = { choice: NfeChoice; ingredientId: string; packQty: string; packUnit: PurchaseUnit };
type Picks = Record<string, Pick>; // `${accessKey}|${code}`

const UNITS: PurchaseUnit[] = ["kg", "g", "l", "ml", "un"];
const field = "h-11 card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const keyOf = (n: NfePreviewNote, i: NfePreviewItem) => `${n.accessKey}|${i.code}`;

function initialPick(item: NfePreviewItem): Pick {
  const r = item.remembered;
  if (r?.choice === "ignore") return { choice: "ignore", ingredientId: "", packQty: "", packUnit: "un" };
  const id = r?.ingredientId ?? item.suggestedId ?? "";
  return { choice: id ? "update" : "skip", ingredientId: id, packQty: r?.packQty ? String(r.packQty).replace(".", ",") : "", packUnit: r?.packUnit ?? "un" };
}

function packOf(p: Pick) {
  const q = parseDecimal(p.packQty);
  return q !== null && Number(q) > 0 ? { qty: Number(q), unit: p.packUnit } : null;
}

/** Preço novo do insumo para este item, ou o motivo de não dar para calcular. */
function previewPrice(item: NfePreviewItem, p: Pick, ing: NfeIngredient | undefined) {
  const cost = nfeCostPerBase(item, packOf(p));
  if (!cost) return { need: "pack" as const };
  if (!ing) return { cost };
  const price = newPurchasePrice(cost, ing);
  return price === null ? { cost, mismatch: true as const } : { cost, price };
}

export function NfeImporter() {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Extract<NfePreview, { ok: true }> | null>(null);
  const [picks, setPicks] = useState<Picks>({});
  const [addPurchases, setAddPurchases] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function read(chosen: File[]) {
    setError(null);
    setDone(null);
    setPreview(null);
    setFiles(chosen);
    if (chosen.length === 0) return;
    const fd = new FormData();
    for (const f of chosen) fd.append("xml", f);
    startReading(async () => {
      const res = await previewNfe(fd);
      if (!res.ok) return setError(res.error);
      const next: Picks = {};
      for (const n of res.notes) for (const i of n.items) next[keyOf(n, i)] = initialPick(i);
      setPicks(next);
      setAddPurchases(Object.fromEntries(res.notes.map((n) => [n.accessKey, true])));
      setPreview(res);
    });
  }

  function save() {
    if (!preview) return;
    const notes = preview.notes
      .filter((n) => !n.alreadyImported)
      .map((n) => ({
        accessKey: n.accessKey,
        addToPurchases: addPurchases[n.accessKey] ?? false,
        decisions: n.items.map((i) => {
          const p = picks[keyOf(n, i)];
          const pack = packOf(p);
          return { code: i.code, choice: p.choice, ...(p.choice === "update" && p.ingredientId ? { ingredientId: p.ingredientId } : {}), ...(pack ? { packQty: pack.qty, packUnit: pack.unit } : {}) };
        }),
      }));
    const fd = new FormData();
    for (const f of files) fd.append("xml", f);
    fd.set("decisions", JSON.stringify(notes));
    setError(null);
    startSaving(async () => {
      const res = await applyNfe(fd);
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      setPreview(null);
      setFiles([]);
      if (input.current) input.current.value = "";
    });
  }

  const ingredients = preview?.ingredients ?? [];
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const importable = preview?.notes.filter((n) => !n.alreadyImported) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        <span>
          Arquivos XML da nota
          <Hint>O XML é o arquivo da nota fiscal eletrônica (NF-e). O fornecedor envia junto com o PDF (o DANFE). Você pode escolher várias notas de uma vez.</Hint>
        </span>
        <input
          ref={input}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          onChange={(e) => read(Array.from(e.target.files ?? []))}
          className="card p-3 text-sm file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-primary-foreground"
        />
      </label>

      {reading ? (
        <p role="status" className="text-sm text-muted">
          <PendingLabel>Lendo as notas…</PendingLabel>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="whitespace-pre-line rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {done ? (
        <div role="status" className="flex flex-col gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          <p className="whitespace-pre-line">{done}</p>
          <Link href="/insumos" className="font-semibold underline">
            Ver os insumos
          </Link>
        </div>
      ) : null}
      {preview?.problems.map((p) => (
        <p key={p} className="rounded-lg bg-warning/10 px-3 py-2 text-sm">
          {p}
        </p>
      ))}

      {preview?.notes.map((n) => (
        <section key={n.accessKey} className="flex flex-col gap-3 card p-4">
          <header className="flex flex-col gap-0.5">
            <h2 className="font-bold leading-snug">{n.supplierName}</h2>
            <p className="tabular text-sm text-muted">
              Nota {n.number ?? "s/n"} · {new Date(n.issuedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {formatBRL(n.total)} · {n.items.length}{" "}
              {n.items.length === 1 ? "item" : "itens"}
            </p>
          </header>

          {n.alreadyImported ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm">Esta nota já foi importada antes. Ela não será contada de novo.</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {n.items.map((i) => {
                  const k = keyOf(n, i);
                  const p = picks[k];
                  if (!p) return null;
                  const set = (patch: Partial<Pick>) => setPicks((cur) => ({ ...cur, [k]: { ...cur[k], ...patch } }));
                  const ing = byId.get(p.ingredientId);
                  const isPack = classifyUnit(i.unit).kind === "pack";
                  const calc = p.choice === "ignore" || p.choice === "skip" ? null : previewPrice(i, p, p.choice === "update" ? ing : undefined);
                  const change = calc && "price" in calc && ing && ing.purchase_price > 0 ? (calc.price! - ing.purchase_price) / ing.purchase_price : null;
                  return (
                    <li key={k} className="flex flex-col gap-2 py-3">
                      <div>
                        <p className="font-semibold leading-snug">{i.name}</p>
                        <p className="tabular text-sm text-muted">
                          {formatNumber(i.qty, 3)} {i.unit} · {formatBRL(i.total / i.qty)} cada · {formatBRL(i.total)}
                        </p>
                      </div>
                      <select value={p.choice === "update" ? p.ingredientId || "pick" : p.choice} onChange={(e) => {
                        const v = e.target.value;
                        if (v === "create" || v === "ignore" || v === "skip") set({ choice: v });
                        else set({ choice: "update", ingredientId: v === "pick" ? "" : v });
                      }} className={field} aria-label={`O que fazer com ${i.name}`}>
                        <option value="skip">Não importar este item</option>
                        <option value="ignore">Não é insumo (ignorar sempre)</option>
                        <option value="create">Criar insumo novo</option>
                        <optgroup label="Atualizar o preço de…">
                          {p.choice === "update" && !p.ingredientId ? <option value="pick">Escolha o insumo</option> : null}
                          {ingredients.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {isPack && p.choice !== "ignore" && p.choice !== "skip" ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="shrink-0">1 {i.unit} traz</span>
                          <input value={p.packQty} onChange={(e) => set({ packQty: e.target.value })} inputMode="decimal" placeholder="Ex.: 30" aria-label="Conteúdo da embalagem" className={`${field} w-24`} />
                          <select value={p.packUnit} onChange={(e) => set({ packUnit: e.target.value as PurchaseUnit })} className={field} aria-label="Unidade do conteúdo">
                            {UNITS.map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      {calc && "need" in calc ? <p className="text-sm text-warning">Informe quanto vem em cada {i.unit} para calcular o preço.</p> : null}
                      {calc && "mismatch" in calc ? <p className="text-sm text-danger">A medida da nota não combina com a do insumo (peso × litro × unidade).</p> : null}
                      {calc && "price" in calc && ing ? (
                        <p className="tabular text-sm">
                          {formatBRL(ing.purchase_price)} → <strong>{formatBRL(calc.price!)}</strong> por {formatNumber(ing.purchase_qty, 3)} {ing.purchase_unit}
                          {change !== null ? (
                            <span className={Math.abs(change) >= 0.3 ? "font-semibold text-warning" : "text-muted"}>
                              {" "}
                              ({change >= 0 ? "+" : ""}
                              {formatNumber(change * 100, 1)}%{Math.abs(change) >= 0.3 ? " — confira" : ""})
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5" checked={addPurchases[n.accessKey] ?? false} onChange={(e) => setAddPurchases((c) => ({ ...c, [n.accessKey]: e.target.checked }))} />
                <span>
                  Somar {formatBRL(n.total)} às compras do mês
                  <Hint>As compras do mês entram no CMV. Desmarque se você já lançou esse valor em Fechar o mês, para não contar duas vezes.</Hint>
                </span>
              </label>
            </>
          )}
        </section>
      ))}

      {importable.length > 0 ? (
        <button type="button" onClick={save} disabled={saving} className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? <PendingLabel>Importando…</PendingLabel> : `Importar ${importable.length} ${importable.length === 1 ? "nota" : "notas"}`}
        </button>
      ) : null}
    </div>
  );
}
