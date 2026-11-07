"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fichaDocNome } from "@/lib/ficha-nome";
import { CAMPO_GRUPOS, CAMPO_LABEL, MODELOS, camposToParam, modeloDe, type FichaCampo, type FichaCampos } from "@/lib/ficha-campos";

const T = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", zebra: "#F3F8F7", muted: "#475569" };

const ING = [
  { name: "Carne moída refogada", receita: true, net: "120 g", fc: "1", gross: "120 g", cost: "R$ 4,51" },
  { name: "Cebola in natura", receita: false, net: "336 g", fc: "1,09", gross: "365,9 g", cost: "R$ 3,29" },
  { name: "Penne cozido", receita: true, net: "115 g", fc: "1", gross: "115 g", cost: "R$ 0,52" },
];
const EMB = [{ name: "Embalagem", receita: false, net: "1 un", fc: "1", gross: "1 un", cost: "R$ 1,05" }];

/** Miniatura da ficha com dados de exemplo: muda na hora conforme os campos marcados. */
function Preview({ c, doc }: { c: FichaCampos; doc: string }) {
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
    <div className="w-[340px] rounded-md bg-white p-3 text-[#0F172A] shadow-md ring-1 ring-black/10" aria-label="Exemplo de como a ficha vai sair">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg text-sm font-black text-white" style={{ background: T.teal }}>P</span>
        <div className="leading-tight">
          <p className="text-[12px] font-bold" style={{ color: T.deep }}>Nome da sua empresa</p>
          <p className="text-[7px] uppercase tracking-widest" style={{ color: T.muted }}>{doc}</p>
        </div>
      </div>
      <div className="mt-2 h-[3px] rounded" style={{ background: T.lime }} />
      <p className="mt-2 text-[15px] font-bold" style={{ color: T.deep }}>Penne a bolonhesa</p>

      {c.foto ? (
        <div className="mt-2 grid h-[84px] w-[118px] place-items-center rounded-md text-[8px] font-semibold" style={{ background: T.tint, color: T.muted }}>
          Foto do produto
        </div>
      ) : null}

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

      {!c.ingredientes && !c.embalagens && !c.foto && !cards.length && !c.custo && !c.custoPorMarmita && !c.modoPreparo ? (
        <p className="mt-4 text-center text-[10px]" style={{ color: T.muted }}>Marque algum campo para ele aparecer aqui.</p>
      ) : null}

      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[8px] font-bold" style={{ color: T.teal }}>Precificaí · powered by Grupo Shogun</div>
    </div>
  );
}

/** A ficha inteira, encolhida para caber na área (sem rolar), com a largura de papel de 340 px. */
function FitPreview({ c, height, doc }: { c: FichaCampos; /** Sem altura fixa, a prévia ocupa o que sobrar da coluna (desktop, em qualquer altura de janela). */ height?: number; doc: string }) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0.8, left: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !page.current) return;
      const w = box.current.clientWidth;
      const h = box.current.clientHeight;
      const scale = Math.min(w / 340, h / page.current.offsetHeight, 1.4);
      setFit({ scale, left: (w - 340 * scale) / 2 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (page.current) ro.observe(page.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={`relative w-full overflow-hidden ${height === undefined ? "min-h-0 flex-1" : ""}`} style={height === undefined ? undefined : { height }}>
      <div ref={page} className="absolute top-0 origin-top-left" style={{ left: fit.left, transform: `scale(${fit.scale})` }}>
        <Preview c={c} doc={doc} />
      </div>
    </div>
  );
}

const chip = (on: boolean) =>
  `flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;

/** Janela para montar a ficha: prévia ao vivo no alto (a ficha inteira), modelos e campos embaixo, botão fixo. */
export function PersonalizarModal({ campos, itemId, itemName, kind, onSave, onClose }: { campos: FichaCampos; itemId: string; itemName: string; kind: "marmita" | "receita"; onSave: (c: FichaCampos) => void; onClose: () => void }) {
  const doc = fichaDocNome(kind);
  const [draft, setDraft] = useState<FichaCampos>({ ...campos });
  const [grande, setGrande] = useState(false);
  const modelo = modeloDe(draft);
  const marcados = camposToParam(draft) === "" ? 0 : camposToParam(draft).split(",").length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 lg:items-center lg:p-4" role="dialog" aria-modal="true" aria-label="Baixar ficha" onClick={onClose}>
      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-surface lg:h-[85dvh] lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-border py-1 pl-4 pr-1">
          <div className="min-w-0">
            <p className="font-extrabold leading-tight">Baixar ficha</p>
            <p className="truncate text-xs text-muted">{itemName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 place-items-center rounded-full text-xl text-muted">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Prévia */}
          <div className="shrink-0 border-b border-border bg-black/5 px-3 pb-2 pt-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:border-b-0 lg:border-r">
            <div className="lg:hidden">
              <FitPreview c={draft} height={grande ? 460 : 250} doc={doc} />
            </div>
            <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <FitPreview c={draft} doc={doc} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Exemplo com dados fictícios</p>
              <button type="button" onClick={() => setGrande((g) => !g)} className="h-9 rounded-full px-3 text-xs font-semibold text-primary lg:hidden">
                {grande ? "Reduzir prévia" : "Ampliar prévia"}
              </button>
            </div>
          </div>

          {/* Controles */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:w-[380px] lg:flex-none">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Modelo pronto</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modelo">
                {MODELOS.map((m) => (
                  <button key={m.id} type="button" aria-pressed={modelo === m.id} onClick={() => setDraft({ ...m.campos })} className={`h-12 rounded-xl border text-sm font-semibold ${modelo === m.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface"}`}>
                    {m.nome}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">{modelo ? MODELOS.find((m) => m.id === modelo)?.descricao : "Personalizada: ajuste os campos abaixo."}</p>
            </div>

            {CAMPO_GRUPOS.map((g) => (
              <div key={g.titulo}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.titulo}</p>
                {g.dica ? <p className="mb-1.5 text-xs text-muted">{g.dica}</p> : <div className="mb-1.5" />}
                <div className="flex flex-wrap gap-2">
                  {g.campos.map((c: FichaCampo) => (
                    <button key={c} type="button" aria-pressed={draft[c]} onClick={() => setDraft({ ...draft, [c]: !draft[c] })} className={chip(draft[c])}>
                      <span aria-hidden>{draft[c] ? "✓" : "+"}</span>
                      {CAMPO_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {marcados === 0 ? (
            <p className="py-3 text-center text-sm font-semibold text-warning">Marque ao menos um campo para baixar</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(["pdf", "xlsx"] as const).map((formato) => (
                <a
                  key={formato}
                  href={`/cardapio/fichas/baixar?id=${itemId}&formato=${formato}&campos=${encodeURIComponent(camposToParam(draft))}`}
                  download
                  onClick={() => {
                    onSave(draft);
                    setTimeout(onClose, 400);
                  }}
                  className={`flex h-12 items-center justify-center rounded-xl border text-base font-semibold ${formato === "pdf" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
                >
                  {formato === "pdf" ? "Baixar PDF" : "Baixar Excel"}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
