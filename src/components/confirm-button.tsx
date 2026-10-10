"use client";

import { useId, useRef } from "react";

/**
 * Botão que abre uma janela de confirmação antes de enviar o formulário em que está.
 * Para ações que mexem em algo da tela (arquivar, duplicar, remover): o toque errado não faz nada.
 */
export function ConfirmButton({
  message,
  title = "Tem certeza?",
  confirmLabel = "Confirmar",
  destructive = true,
  className,
  children,
}: {
  message: string;
  title?: string;
  confirmLabel?: string;
  /** Vermelho (arquivar, remover) ou normal (duplicar). */
  destructive?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button type="button" className={className} onClick={() => dialog.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="text-lg font-extrabold">
              {title}
            </h2>
            <p className="text-sm leading-relaxed text-muted">{message}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className="h-12 card font-semibold">
              Cancelar
            </button>
            <button
              type="submit"
              onClick={() => dialog.current?.close()}
              className={`h-12 rounded-xl font-semibold text-white ${destructive ? "bg-danger" : "bg-primary"}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
