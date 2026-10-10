"use client";

import { useState } from "react";

/** Passo recolhível. Só começa aberto se for o próximo a preencher; depois disso quem manda é o toque da pessoa. */
export function StepCard({ index, title, status, done, startOpen, children }: { index: number; title: string; status: string; done: boolean; startOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className="rounded-xl border border-border bg-surface">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
        <span aria-hidden className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-success text-primary-foreground" : "bg-border text-muted"}`}>
          {done ? "✓" : index}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="font-semibold">{title}</span>
          <span className={`tabular text-sm ${done ? "text-muted" : "text-warning"}`}>{status}</span>
        </span>
        <span aria-hidden className={`text-muted transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? <div className="flex flex-col gap-3 border-t border-border p-4">{children}</div> : null}
    </div>
  );
}
