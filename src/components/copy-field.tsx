"use client";

import { useState } from "react";

/** Texto longo (endereço do aviso, token) com botão de copiar. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sem permissão de área de transferência: o texto continua selecionável
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-3 py-2 text-xs">{value}</code>
        <button type="button" onClick={copy} className="h-auto min-h-11 shrink-0 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-primary">
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
