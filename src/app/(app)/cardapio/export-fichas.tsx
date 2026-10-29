"use client";

import { useState } from "react";

type Step = "closed" | "options" | "pick" | "format";

const btn = "flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold";

/**
 * "Baixar fichas", no fim da lista: escolhe entre todas ou algumas (com caixinhas) e depois o formato (PDF ou Excel).
 * Os arquivos são links comuns: o servidor responde com o download.
 */
export function ExportFichas({ fichas }: { fichas: { id: string; name: string }[] }) {
  const [step, setStep] = useState<Step>("closed");
  const [all, setAll] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const href = (format: "pdf" | "xlsx") => `/cardapio/exportar?formato=${format}${all ? "" : `&ids=${[...picked].join(",")}`}`;

  if (step === "closed") {
    return (
      <button type="button" onClick={() => setStep("options")} className={`${btn} w-full`}>
        Baixar fichas
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 card p-4" aria-label="Baixar fichas">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Baixar fichas</h2>
        <button type="button" onClick={() => setStep("closed")} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-xl text-xl leading-none text-muted">
          ×
        </button>
      </div>

      {step === "options" ? (
        <>
          <button
            type="button"
            className={btn}
            onClick={() => {
              setAll(true);
              setStep("format");
            }}
          >
            Baixar todas as fichas
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => {
              setAll(false);
              setStep("pick");
            }}
          >
            Escolher fichas
          </button>
        </>
      ) : null}

      {step === "pick" ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{picked.size} de {fichas.length} marcadas</span>
            <button type="button" onClick={() => setPicked(picked.size === fichas.length ? new Set() : new Set(fichas.map((f) => f.id)))} className="min-h-11 font-semibold text-primary">
              {picked.size === fichas.length ? "Desmarcar todas" : "Marcar todas"}
            </button>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {fichas.map((f) => (
              <li key={f.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" checked={picked.has(f.id)} onChange={() => toggle(f.id)} className="size-5 accent-[var(--color-primary)]" />
                  <span className="min-w-0 truncate">{f.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" disabled={picked.size === 0} onClick={() => setStep("format")} className="h-12 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-50">
            Continuar
          </button>
        </>
      ) : null}

      {step === "format" ? (
        <>
          <p className="text-sm text-muted">{all ? "Todas as fichas." : `${picked.size} ${picked.size === 1 ? "ficha escolhida" : "fichas escolhidas"}.`} Em qual formato?</p>
          <a href={href("pdf")} download className={btn}>
            PDF · uma ficha por página, para a cozinha
          </a>
          <a href={href("xlsx")} download className={btn}>
            Excel · cópia de segurança
          </a>
          <button type="button" onClick={() => setStep(all ? "options" : "pick")} className="min-h-11 text-sm font-semibold text-muted">
            Voltar
          </button>
        </>
      ) : null}
    </section>
  );
}
