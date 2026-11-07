"use client";

import { useEffect, useId, useRef, useState } from "react";

export type ShareItem = { key: string; label: string; hint?: string; onClick?: () => void; href?: string };

/**
 * Um botão só ("Compartilhar") que abre as várias formas de levar a lista ou a ficha embora (copiar, WhatsApp, baixar…),
 * em vez de deixar vários botões juntos na tela.
 */
export function ShareMenu({ items, label = "Compartilhar" }: { items: ShareItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  // Toque fora (ou Esc) fecha o menu.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => e.target instanceof Node && !root.current?.contains(e.target) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const row = "flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-semibold";
  return (
    <div ref={root} className="flex flex-col gap-2">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
        <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 11v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
        </svg>
        {label}
        <span aria-hidden className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open ? (
        <ul id={id} className="flex flex-col divide-y divide-border overflow-hidden card">
          {items.map((it) => (
            <li key={it.key}>
              {it.href ? (
                <a href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={row}>
                  <span>{it.label}</span>
                  {it.hint ? <span className="text-xs font-normal text-muted">{it.hint}</span> : null}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    it.onClick?.();
                  }}
                  className={row}
                >
                  <span>{it.label}</span>
                  {it.hint ? <span className="text-xs font-normal text-muted">{it.hint}</span> : null}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
