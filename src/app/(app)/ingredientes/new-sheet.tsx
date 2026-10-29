"use client";

import Link from "next/link";
import { useRef } from "react";

const option = "flex min-h-14 flex-col justify-center rounded-xl border border-border bg-surface px-4 py-2 active:bg-tint";

/**
 * O único botão de ação da tela de Ingredientes: "+ Novo". Abre uma folha por baixo com o que dá para criar
 * (insumo, receita, embalagem) e, recolhidas em "Mais opções", as importações e o reajuste de preços.
 */
export function NewSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
        + Novo
      </button>
      <dialog
        ref={ref}
        aria-labelledby="new-sheet-title"
        onClick={(e) => e.target === ref.current && close()}
        className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <h2 id="new-sheet-title" className="text-lg font-extrabold">
              O que você quer criar?
            </h2>
            <button type="button" onClick={close} aria-label="Fechar" className="flex size-11 items-center justify-center rounded-xl text-xl leading-none text-muted active:bg-background">
              ×
            </button>
          </div>
          <Link href="/ingredientes/novo" onClick={close} className={option}>
            <span className="font-semibold">Novo insumo</span>
            <span className="text-xs text-muted">Carne, arroz, tempero… o que você compra para cozinhar</span>
          </Link>
          <Link href="/ingredientes/receitas/nova" onClick={close} className={option}>
            <span className="font-semibold">Nova receita</span>
            <span className="text-xs text-muted">O que você faz em lote e usa em várias marmitas (arroz, estrogonofe)</span>
          </Link>
          <Link href="/ingredientes/novo?tipo=embalagem" onClick={close} className={option}>
            <span className="font-semibold">Nova embalagem</span>
            <span className="text-xs text-muted">Bandeja, filme, etiqueta, lacre</span>
          </Link>
          <details className="rounded-xl border border-border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-muted">Mais opções</summary>
            <div className="flex flex-col border-t border-border px-2 pb-1">
              <Link href="/ingredientes/nfe" onClick={close} className="flex min-h-11 items-center px-2 text-sm font-semibold text-primary">
                Importar nota fiscal (XML)
              </Link>
              <Link href="/ingredientes/catalogo" onClick={close} className="flex min-h-11 items-center px-2 text-sm font-semibold text-primary">
                Importar do catálogo de insumos
              </Link>
              <Link href="/ingredientes/reajuste" onClick={close} className="flex min-h-11 items-center px-2 text-sm font-semibold text-primary">
                Reajustar vários preços de uma vez (%)
              </Link>
            </div>
          </details>
        </div>
      </dialog>
    </>
  );
}
