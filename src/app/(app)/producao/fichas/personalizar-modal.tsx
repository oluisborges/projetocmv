"use client";

import { useEffect, useState } from "react";
import { CAMPO_GRUPOS, CAMPO_LABEL, MODELOS, camposToParam, modeloDe, type FichaCampo, type FichaCampos } from "@/lib/ficha-campos";

const T = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", zebra: "#F3F8F7", muted: "#475569" };

const ING = [
  { name: "Carne moída refogada", receita: true, net: "120 g", fc: "1", gross: "120 g", cost: "R$ 4,51" },
  { name: "Cebola in natura", receita: false, net: "336 g", fc: "1,09", gross: "365,9 g", cost: "R$ 3,29" },
  { name: "Penne cozido", receita: true, net: "115 g", fc: "1", gross: "115 g", cost: "R$ 0,52" },
];
const EMB = [{ name: "Embalagem", receita: false, net: "1 un", fc: "1", gross: "1 un", cost: "R$ 1,05" }];

/** Miniatura da ficha com dados de exemplo: muda na hora conforme os campos marcados. */
function Preview({ c }: { c: FichaCampos }) {
  const cards = [
    c.custoPorMarmita && { l: "Custo por marmita", v: "R$ 10,20" },
    c.pesoPorcao && { l: "Peso da porção", v: "571 g" },
    c.precoVenda && { l: "Preço de venda", v: "R$ 24,00" },
    c.cmv && { l: "CMV", v: "42,5%" },
  ].filter(Boolean) as { l: string; v: string }[];

  const table = (title: string, rows: typeof ING) => (
    <div className="mt-3">
      <p className="flex items-center gap-1 text-[10px] font-bold" style={{ color: T.teal }}>
        <span className="inline-block size-1.5 rounded-[2px]" style={{ background: T.lime }} />
        {title}
      </p>
      <div className="mt-1 flex rounded px-1.5 py-1 text-[8px] font-bold text-white" style={{ background: T.teal }}>
        <span className="flex-1">Ingrediente</span>
        {c.pesoLiquido ? <span className="w-12 text-right">Peso líq.</span> : null}
        {c.fc ? <span className="w-8 text-right">FC</span> : null}
        {c.pesoBruto ? <span className="w-12 text-right">Peso bruto</span> : null}
        {c.custo ? <span className="w-12 text-right">Custo</span> : null}
      </div>
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center px-1.5 py-1 text-[9px]" style={i % 2 === 0 ? { background: T.zebra } : undefined}>
          <span className="flex-1">{r.name}</span>
          {c.pesoLiquido ? <span className="w-12 text-right">{r.net}</span> : null}
          {c.fc ? <span className="w-8 text-right" style={{ color: T.muted }}>{r.fc}</span> : null}
          {c.pesoBruto ? <span className="w-12 text-right">{r.gross}</span> : null}
          {c.custo ? <span className="w-12 text-right font-bold">{r.cost}</span> : null}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[420px] rounded-md bg-white p-3 text-[#0F172A] shadow-md ring-1 ring-black/10" aria-label="Exemplo de como a ficha vai sair">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg text-sm font-black text-white" style={{ background: T.teal }}>P</span>
        <div className="leading-tight">
          <p className="text-[12px] font-bold" style={{ color: T.deep }}>Sua Marmitaria</p>
          <p className="text-[7px] uppercase tracking-widest" style={{ color: T.muted }}>Ficha técnica</p>
        </div>
      </div>
      <div className="mt-2 h-[3px] rounded" style={{ background: T.lime }} />
      <p className="mt-2 text-[15px] font-bold" style={{ color: T.deep }}>Penne a bolonhesa</p>

      {cards.length > 0 ? (
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
          {cards.map((k) => (
            <div key={k.l} className="rounded-md px-1.5 py-1" style={{ background: T.tint }}>
              <p className="text-[6px] uppercase tracking-wider" style={{ color: T.muted }}>{k.l}</p>
              <p className="text-[11px] font-bold" style={{ color: T.deep }}>{k.v}</p>
            </div>
          ))}
        </div>
      ) : null}

      {c.ingredientes ? table("Ingredientes", ING) : null}
      {c.embalagens ? table("Embalagens", EMB) : null}

      {c.custo || c.custoPorMarmita ? (
        <div className="mt-3 ml-auto w-[60%] text-[9px]">
          {c.custo ? (
            <>
              <p className="flex justify-between px-1" style={{ color: T.muted }}><span>Ingredientes</span><span>R$ 8,32</span></p>
              <p className="flex justify-between px-1" style={{ color: T.muted }}><span>Embalagem</span><span>R$ 1,05</span></p>
              <p className="flex justify-between px-1" style={{ color: T.muted }}><span>Margem (10%)</span><span>R$ 0,83</span></p>
            </>
          ) : null}
          <p className="mt-1 flex justify-between rounded px-1.5 py-1 font-bold text-white" style={{ background: T.teal }}><span>Custo por marmita</span><span>R$ 10,20</span></p>
        </div>
      ) : null}

      {c.modoPreparo ? (
        <div className="mt-3">
          <p className="flex items-center gap-1 text-[10px] font-bold" style={{ color: T.teal }}>
            <span className="inline-block size-1.5 rounded-[2px]" style={{ background: T.lime }} />
            Modo de preparo e observações
          </p>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-3.5 border-b border-dashed border-slate-300" />
          ))}
        </div>
      ) : null}

      {!c.ingredientes && !c.embalagens && !cards.length && !c.custo && !c.custoPorMarmita && !c.modoPreparo ? (
        <p className="mt-4 text-center text-[10px]" style={{ color: T.muted }}>Marque algum campo para ele aparecer aqui.</p>
      ) : null}

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[8px] font-bold" style={{ color: T.teal }}>Precificaí · powered by Grupo Shogun</div>
    </div>
  );
}

/** Janela para montar a ficha: modelos prontos, caixinhas e uma prévia ao vivo. */
export function PersonalizarModal({ campos, onApply, onClose }: { campos: FichaCampos; onApply: (c: FichaCampos) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<FichaCampos>({ ...campos });
  const modelo = modeloDe(draft);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Personalizar a ficha técnica" onClick={onClose}>
      <div className="flex h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-surface sm:h-[85dvh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-extrabold">Personalizar a ficha</p>
            <p className="text-xs text-muted">A prévia muda conforme você marca.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 place-items-center rounded-full text-xl text-muted">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="h-[40%] shrink-0 overflow-y-auto border-b border-border bg-black/5 p-3 lg:h-auto lg:flex-1 lg:border-b-0 lg:border-r">
            <Preview c={draft} />
            <p className="mt-2 text-center text-[11px] text-muted">Exemplo com dados fictícios. Na ficha real entram os seus.</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:w-[380px] lg:flex-none">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modelo">
              {MODELOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={modelo === m.id}
                  onClick={() => setDraft({ ...m.campos })}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left ${modelo === m.id ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                >
                  <span className="block text-sm font-semibold">{m.nome}</span>
                  <span className="block text-xs leading-snug text-muted">{m.descricao}</span>
                </button>
              ))}
            </div>

            {CAMPO_GRUPOS.map((g) => (
              <fieldset key={g.titulo} className="flex flex-col">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted">{g.titulo}</legend>
                {g.dica ? <p className="mb-1 text-xs text-muted">{g.dica}</p> : null}
                {g.campos.map((c: FichaCampo) => (
                  <label key={c} className="tap-area flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={draft[c]} onChange={(e) => setDraft({ ...draft, [c]: e.target.checked })} className="size-5 accent-[var(--color-primary)]" />
                    {CAMPO_LABEL[c]}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl border border-border bg-surface text-sm font-semibold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={camposToParam(draft) === ""}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="h-12 flex-[2] rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Usar esta ficha
          </button>
        </div>
      </div>
    </div>
  );
}
