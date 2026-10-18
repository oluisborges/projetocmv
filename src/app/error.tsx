"use client";

import { useEffect } from "react";
import { reportClientError } from "@/app/report-error";

/** Rede de segurança: se uma tela quebrar no navegador, a pessoa vê uma mensagem clara (não a tela branca) e a equipe é avisada. */
export default function GlobalRouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    void reportClientError(error.message || "Erro na tela", error.stack ?? null, typeof window === "undefined" ? null : window.location.pathname);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Algo deu errado por aqui</h1>
      <p className="text-muted">A equipe do Precificaí já foi avisada. Tente de novo; se continuar, fale com o suporte.</p>
      <button type="button" onClick={() => retry()} className="h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground">
        Tentar de novo
      </button>
    </main>
  );
}
