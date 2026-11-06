"use client";

import { useState, useTransition } from "react";
import { saveRecipeInstructions } from "@/app/(app)/cardapio/actions";

const MAX = 4000;

/** Texto livre da ficha: modo de preparo (receita) ou passo a passo da montagem (produto). */
export function InstructionsCard({ recipeId, initial, kind, canWrite }: { recipeId: string; initial: string | null; kind: "marmita" | "receita"; canWrite: boolean }) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const product = kind === "marmita";
  const dirty = text.trim() !== saved.trim();

  const save = () =>
    start(async () => {
      const res = await saveRecipeInstructions(recipeId, text);
      if (res.ok) {
        setSaved(text);
        setMsg({ ok: true, text: "Salvo." });
      } else setMsg({ ok: false, text: res.error });
    });

  return (
    <section className="flex flex-col gap-3 card p-4">
      <div>
        <h2 className="font-semibold">{product ? "Passo a passo da montagem" : "Modo de preparo"}</h2>
        <p className="text-sm text-muted">
          {product ? "Como montar e fechar a marmita, em ordem. Sai na ficha de montagem impressa." : "Como preparar o lote, passo a passo. Sai na ficha técnica impressa."}
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMsg(null);
        }}
        disabled={!canWrite}
        rows={6}
        maxLength={MAX}
        placeholder={product ? "Ex.: 1. Arroz no fundo. 2. Feijão ao lado. 3. Proteína por cima. 4. Fechar com filme e etiquetar." : "Ex.: 1. Refogue a cebola. 2. Junte a carne e deixe dourar. 3. Cozinhe por 40 minutos."}
        className="w-full rounded-xl border border-border bg-surface p-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
        aria-label={product ? "Passo a passo da montagem" : "Modo de preparo"}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">{text.length} de {MAX} letras</span>
        {canWrite ? (
          <button type="button" disabled={pending || !dirty} onClick={save} className="min-h-11 rounded-xl border border-primary bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {pending ? "Salvando…" : "Salvar texto"}
          </button>
        ) : null}
      </div>
      {msg ? <p role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.text}</p> : null}
    </section>
  );
}
