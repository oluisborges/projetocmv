"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { PendingLabel } from "@/components/spinner";
import { formatBRL, formatNumber } from "@/lib/format";
import { INGREDIENT_TEMPLATE, RECIPE_TEMPLATE } from "@/lib/sheet-import";
import { applySheet, previewSheet } from "./actions";
import type { SheetKind, SheetPreview } from "./types";

const MODES: Record<SheetKind, { label: string; help: string; columns: string; template: string; file: string }> = {
  insumos: {
    label: "Insumos",
    help: "Uma linha por insumo.",
    columns: "Nome, Unidade (kg, g, l, ml ou un), Quantidade da compra, Preço pago, Categoria e Fator de correção. Só Nome e Unidade são obrigatórios.",
    template: INGREDIENT_TEMPLATE,
    file: "modelo-insumos.csv",
  },
  fichas: {
    label: "Fichas",
    help: "Uma linha por insumo da ficha, repetindo o nome da ficha. As quantidades são de UMA marmita.",
    columns: "Ficha, Insumo, Quantidade e Unidade (g, kg, ml, l ou un). Os insumos precisam estar cadastrados (importe-os antes).",
    template: RECIPE_TEMPLATE,
    file: "modelo-fichas.csv",
  },
};

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SheetImporter({ orgId }: { orgId: string }) {
  const [kind, setKind] = useState<SheetKind>("insumos");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Extract<SheetPreview, { ok: true }> | null>(null);
  const [updatePrices, setUpdatePrices] = useState(false);
  const [units, setUnits] = useState<Record<number, string>>({}); // unidade escolhida nas linhas que vieram sem unidade
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const mode = MODES[kind];

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (input.current) input.current.value = "";
  }

  function pick(f: File | null) {
    setError(null);
    setDone(null);
    setPreview(null);
    setUnits({});
    setFile(f);
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    fd.set("org", orgId);
    startReading(async () => {
      const res = await previewSheet(kind, fd);
      if (!res.ok) return setError(res.error);
      setPreview(res);
    });
  }

  function save() {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("org", orgId);
    if (updatePrices) fd.set("update_prices", "1");
    fd.set("units", JSON.stringify(units));
    setError(null);
    startSaving(async () => {
      const res = await applySheet(kind, fd);
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      reset();
    });
  }

  const toImport = preview ? (preview.kind === "insumos" ? preview.rows.filter((r) => r.status === "new" || (updatePrices && r.price > 0)).length : preview.recipes.filter((r) => r.status === "new").length) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="O que importar" className="flex gap-1 rounded-xl bg-border/60 p-1">
        {(Object.keys(MODES) as SheetKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setDone(null);
              reset();
            }}
            className={`flex h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold ${kind === k ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            {MODES[k].label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 card p-4 text-sm">
        <p>{mode.help}</p>
        <p className="text-muted">Colunas: {mode.columns}</p>
        <button type="button" onClick={() => download(mode.file, mode.template)} className="inline-flex min-h-11 items-center self-start font-semibold text-primary">
          Baixar o modelo (abre no Excel)
        </button>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Sua planilha (.xlsx ou .csv)
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,.txt"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="card p-3 text-sm file:mr-3 file:h-9 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-primary-foreground"
        />
      </label>

      {reading ? (
        <p role="status" className="text-sm text-muted">
          <PendingLabel>Lendo a planilha…</PendingLabel>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {done ? (
        <div role="status" className="flex flex-col gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
          <p>{done}</p>
          <Link href="/admin" className="font-semibold underline">
            Voltar ao Painel Shogun
          </Link>
        </div>
      ) : null}

      {preview?.errors.length ? (
        <div className="flex flex-col gap-1 rounded-xl bg-warning/10 p-3 text-sm">
          <p className="font-semibold">{preview.errors.length} {preview.errors.length === 1 ? "linha não vai entrar" : "linhas não vão entrar"}:</p>
          <ul className="list-disc pl-5">
            {preview.errors.slice(0, 8).map((e) => (
              <li key={`${e.line}-${e.message}`}>
                Linha {e.line}: {e.message}
              </li>
            ))}
          </ul>
          {preview.errors.length > 8 ? <p className="text-muted">…e mais {preview.errors.length - 8}.</p> : null}
        </div>
      ) : null}

      {preview?.kind === "insumos" ? (
        <>
          {preview.rows.some((r) => r.assumed) ? (
            <p className="rounded-xl bg-warning/10 p-3 text-sm">Sua planilha não tem coluna de unidade. Deixei tudo em kg: confira e troque para litro ou unidade nos itens que forem assim.</p>
          ) : null}
          <ul className="divide-y divide-border card px-4">
            {preview.rows.map((r) => (
              <li key={r.line} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{r.name}</p>
                  <p className="tabular text-sm text-muted">
                    {r.price > 0 ? formatBRL(r.price) : "sem preço"} por {formatNumber(r.qty, 3)} {r.assumed ? "" : r.unit}
                    {r.category ? ` · ${r.category}` : ""}
                  </p>
                  {r.assumed ? (
                    <select
                      value={units[r.line] ?? r.unit}
                      onChange={(e) => setUnits((u) => ({ ...u, [r.line]: e.target.value }))}
                      aria-label={`Unidade de ${r.name}`}
                      className="mt-1 h-11 card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="kg">kg (peso)</option>
                      <option value="l">litro</option>
                      <option value="un">unidade</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  ) : null}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "new" ? "bg-success/10 text-success" : "bg-border text-muted"}`}>{r.status === "new" ? "Novo" : "Já existe"}</span>
              </li>
            ))}
          </ul>
          {preview.rows.some((r) => r.status === "exists") ? (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5" checked={updatePrices} onChange={(e) => setUpdatePrices(e.target.checked)} />
              <span>Atualizar o preço dos que já existem (só quando a medida é a mesma)</span>
            </label>
          ) : null}
        </>
      ) : null}

      {preview?.kind === "fichas" ? (
        <ul className="divide-y divide-border card px-4">
          {preview.recipes.map((r) => (
            <li key={r.name} className="flex flex-col gap-1 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-semibold leading-snug">
                  {r.name} <span className="font-normal text-muted">· {r.items} {r.items === 1 ? "insumo" : "insumos"}</span>
                </p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "new" ? "bg-success/10 text-success" : r.status === "exists" ? "bg-border text-muted" : "bg-warning/10 text-warning"}`}>
                  {r.status === "new" ? "Nova" : r.status === "exists" ? "Já existe" : "Com problema"}
                </span>
              </div>
              {r.status === "missing" ? <p className="text-sm text-muted">Não será criada: {r.missing.slice(0, 4).join(", ")}{r.missing.length > 4 ? "…" : ""}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {preview && toImport > 0 ? (
        <button type="button" onClick={save} disabled={saving} className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? <PendingLabel>Importando…</PendingLabel> : `Importar ${toImport} ${kind === "insumos" ? (toImport === 1 ? "insumo" : "insumos") : toImport === 1 ? "ficha" : "fichas"}`}
        </button>
      ) : preview ? (
        <p className="text-sm text-muted">Nada novo para importar neste arquivo.</p>
      ) : null}
    </div>
  );
}
