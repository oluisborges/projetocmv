"use client";

import { useRef, useState, useTransition } from "react";
import { removeRecipePhoto, saveRecipePhoto } from "@/app/(app)/cardapio/actions";

const MAX_SIDE = 900;
const MAX_CHARS = 380_000;

/** Reduz a foto no navegador (lado maior 900 px, JPEG): sai leve para guardar e para entrar no PDF. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("load"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff"; // PNG com fundo transparente vira branco no JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const out = canvas.toDataURL("image/jpeg", quality);
      if (out.length <= MAX_CHARS) return out;
    }
    throw new Error("big");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto de referência do produto para a ficha de montagem. */
export function PhotoCard({ recipeId, initial, canWrite }: { recipeId: string; initial: string | null; canWrite: boolean }) {
  const [photo, setPhoto] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const data = await shrink(file);
        const res = await saveRecipePhoto(recipeId, data);
        if (res.ok) setPhoto(data);
        else setError(res.error);
      } catch {
        setError("Não consegui ler essa foto. Tente outra (JPEG ou PNG).");
      }
    });
  };

  const remove = () =>
    start(async () => {
      const res = await removeRecipePhoto(recipeId);
      if (res.ok) setPhoto(null);
      else setError(res.error);
    });

  return (
    <section className="flex flex-col gap-3 card p-4">
      <div>
        <h2 className="font-semibold">Foto do produto</h2>
        <p className="text-sm text-muted">Mostra como o prato deve ficar. Sai na ficha de montagem quando o campo &quot;Foto do produto&quot; estiver marcado.</p>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto em base64 guardada no banco, não é um arquivo estático
        <img src={photo} alt="Foto de referência do produto" className="aspect-[4/3] w-full max-w-sm rounded-xl object-cover" />
      ) : (
        <p className="rounded-lg bg-black/5 px-3 py-6 text-center text-sm text-muted">Ainda sem foto.</p>
      )}
      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" disabled={pending} onClick={() => input.current?.click()} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {pending ? "Enviando…" : photo ? "Trocar foto" : "Adicionar foto"}
          </button>
          {photo && !confirming ? (
            <button type="button" disabled={pending} onClick={() => setConfirming(true)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold text-danger disabled:opacity-60">
              Remover
            </button>
          ) : null}
          {photo && confirming ? (
            <span className="flex w-full items-center gap-2">
              <span className="min-w-0 flex-1 text-sm font-semibold">Remover a foto?</span>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">
                Não
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  remove();
                }}
                className="min-h-11 rounded-xl bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Remover
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    </section>
  );
}
