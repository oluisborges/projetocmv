"use client";

import { useRouter } from "next/navigation";

/** "← Voltar" para telas fora do menu: volta ao histórico, ou vai ao `fallback` se a pessoa abriu a tela direto. */
export function HistoryBack({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        // Só volta no histórico se a página anterior é deste app (aba nova com link colado não tem de onde voltar).
        const fromApp = window.history.length > 1 && document.referrer.startsWith(window.location.origin);
        if (fromApp) router.back();
        else router.push(fallback);
      }}
      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary"
    >
      ← Voltar
    </button>
  );
}
