"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRecipePrice } from "@/app/(app)/marmitas/precos-actions";
import { Spinner } from "@/components/spinner";
import { formatBRL } from "@/lib/format";

/** Aplica o preço sugerido com um toque (só quem edita). Atualiza a tela e guarda a mudança no histórico de preços. */
export function ApplyPriceButton({ recipeId, price, name }: { recipeId: string; price: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ kind: "idle" | "done" | "error"; message?: string }>({ kind: "idle" });

  if (state.kind === "done") return <p className="text-sm font-semibold text-success">Preço de {name} atualizado para {formatBRL(price)} ✓</p>;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setRecipePrice(recipeId, String(price).replace(".", ","));
            if (!res.ok) return setState({ kind: "error", message: res.error });
            setState({ kind: "done" });
            router.refresh();
          })
        }
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-70"
      >
        {pending ? <Spinner className="size-4" /> : null}
        Aplicar {formatBRL(price)}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
