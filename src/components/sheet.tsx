"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Painel que abre por cima da tela (no celular sobe de baixo; no computador abre no centro). Usa o <dialog> nativo:
 * o foco fica preso dentro, Esc fecha, toque fora fecha e a tela de trás não rola.
 * O conteúdo só existe enquanto está aberto, então formulários começam limpos a cada abertura.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50 open:flex sm:my-auto sm:max-h-[85dvh] sm:max-w-xl sm:rounded-3xl"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-lg font-extrabold">
            {title}
          </h2>
          {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-2xl text-muted active:bg-border/60">
          ×
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">{open ? children : null}</div>
    </dialog>
  );
}
