"use client";

import { useState } from "react";

/**
 * Botão que mostra/esconde um bloco logo abaixo, no mesmo nível (sem menu dentro de menu).
 * `variant="primary"` para a ação principal de uma seção; "link" para ações secundárias dentro de uma linha.
 */
export function Reveal({
  label,
  openLabel,
  variant = "link",
  defaultOpen = false,
  children,
}: {
  label: string;
  /** Texto do botão enquanto aberto (padrão: o mesmo). */
  openLabel?: string;
  variant?: "primary" | "link";
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const base = variant === "primary" ? "h-11 w-full justify-center rounded-xl border border-primary/40 bg-primary/5 px-4 text-sm font-semibold text-primary" : "min-h-11 text-sm font-semibold text-primary";
  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`flex items-center gap-1.5 ${base}`}>
        {open ? (openLabel ?? label) : label}
        <span aria-hidden className={`text-xs transition ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? <div className="rounded-xl border border-border bg-background/60 p-3">{children}</div> : null}
    </div>
  );
}
