"use client";

import { startTransition, useActionState } from "react";
import { PendingLabel } from "@/components/spinner";
import type { AdminState } from "./actions";
import { syncMenuNow } from "./menu-actions";

/**
 * "Atualizar agora": puxa os pedidos do cardápio na hora (um ciclo de até ~50 s; se sobrar trabalho, continua sozinho).
 * Mostra o andamento e o resultado ao lado do botão, sem sair da tela.
 */
export function SyncNowButton({ connectionId, compact = false }: { connectionId: string; compact?: boolean }) {
  const [state, formAction, pending] = useActionState(async (_prev: AdminState, formData: FormData) => syncMenuNow(_prev, formData), {} as AdminState);
  return (
    <form
      className="flex flex-col items-start gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="connectionId" value={connectionId} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`rounded-lg border border-border bg-surface font-semibold text-primary disabled:opacity-70 ${compact ? "h-11 px-3 text-xs" : "h-11 px-4 text-sm"}`}
      >
        {pending ? <PendingLabel>Atualizando…</PendingLabel> : "Atualizar agora"}
      </button>
      {state.error ? (
        <span role="alert" className="text-xs text-danger">
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span role="status" className="text-xs text-success">
          {state.ok}
        </span>
      ) : null}
    </form>
  );
}
