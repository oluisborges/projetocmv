"use client";

import { useEffect, useId, useRef, useState } from "react";

type Card = { file: File; url: string };

/**
 * Abre uma janela com o cartão do resultado já pronto para ver, e dali compartilha (WhatsApp, Instagram…) ou baixa.
 * A imagem é gerada ANTES do toque em "Compartilhar": os celulares só deixam compartilhar logo após um toque,
 * então não dá para gerar a imagem no meio do caminho.
 */
export function ShareButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [card, setCard] = useState<Card | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => () => card && URL.revokeObjectURL(card.url), [card]);

  async function open() {
    dialog.current?.showModal();
    if (card) return;
    setState("loading");
    try {
      const res = await fetch("/painel/cartao", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "meu-resultado-grupo-shogun.png", { type: "image/png" });
      setCard({ file, url: URL.createObjectURL(blob) });
      setCanShare(Boolean(navigator.canShare?.({ files: [file] })));
      setState("ready");
    } catch {
      setState("error");
    }
  }

  function download() {
    if (!card) return;
    const a = document.createElement("a");
    a.href = card.url;
    a.download = card.file.name;
    a.click();
  }

  async function share() {
    if (!card) return;
    try {
      await navigator.share({ files: [card.file], title: "Meu resultado", text: "Calculado com Shogun Precificação, do Grupo Shogun." });
    } catch (e) {
      // Fechar a janela de compartilhar não é erro; qualquer outro problema cai no download.
      if (!(e instanceof DOMException && e.name === "AbortError")) download();
    }
  }

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-sm overflow-y-auto rounded-3xl bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-extrabold">
              Seu resultado
            </h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-full text-xl text-muted">
              ×
            </button>
          </div>

          <div className="aspect-[1080/1350] w-full overflow-hidden rounded-2xl border border-border bg-background">
            {card ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.url} alt="Cartão com o seu lucro líquido e para onde vai cada R$ 100 que você vende" className="size-full object-contain" />
            ) : (
              <div className="flex size-full items-center justify-center p-6 text-center text-sm text-muted">
                {state === "error" ? "Não consegui gerar a imagem agora. Feche e tente de novo." : <span className="animate-pulse">Montando o seu cartão…</span>}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted">A imagem mostra só porcentagens: o seu faturamento não aparece.</p>

          <div className="flex flex-col gap-2">
            {canShare ? (
              <button type="button" onClick={share} disabled={state !== "ready"} className="h-12 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-50">
                Compartilhar
              </button>
            ) : null}
            <button
              type="button"
              onClick={download}
              disabled={state !== "ready"}
              className={`h-12 rounded-xl text-base font-bold disabled:opacity-50 ${canShare ? "border border-border bg-surface" : "bg-primary text-primary-foreground"}`}
            >
              Baixar imagem
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
