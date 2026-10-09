"use client";

import { useId, useState } from "react";

/** Botão "?" que abre uma explicação em linguagem simples (funciona com toque, sem depender de hover). */
export function Hint({ children, label = "O que é isso?" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="inline-flex flex-col align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="relative ml-1.5 inline-flex size-6 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold text-muted before:absolute before:-inset-2.5 before:content-['']"
      >
        ?
      </button>
      {open ? (
        <span id={id} role="note" className="mt-2 block max-w-xs rounded-lg bg-foreground px-3 py-2 text-xs font-normal leading-relaxed text-background">
          {children}
        </span>
      ) : null}
    </span>
  );
}
