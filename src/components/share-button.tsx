"use client";

import { useState } from "react";

/**
 * Gera o cartão do resultado e abre o compartilhar do celular (WhatsApp, Instagram…).
 * Sem suporte a compartilhar arquivo (computador), baixa a imagem.
 */
export function ShareButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function share() {
    setState("busy");
    try {
      const res = await fetch("/painel/cartao");
      if (!res.ok) throw new Error("falhou");
      const blob = await res.blob();
      const file = new File([blob], "meu-resultado-grupo-shogun.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Meu resultado", text: "Calculado com Shogun Precificação, do Grupo Shogun." });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      setState("idle");
    } catch (e) {
      // Fechar a janela de compartilhar não é erro.
      setState(e instanceof DOMException && e.name === "AbortError" ? "idle" : "error");
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button type="button" onClick={share} disabled={state === "busy"} className={className}>
        {state === "busy" ? "Gerando imagem…" : children}
      </button>
      {state === "error" ? (
        <span role="alert" className="text-xs">
          Não consegui gerar a imagem agora. Tente de novo.
        </span>
      ) : null}
    </span>
  );
}
