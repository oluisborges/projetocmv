"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  OPCAO_INFO,
  OPCOES,
  SECAO_DICA,
  SECAO_LABEL,
  SECOES,
  SHEET_MODELOS,
  SHEET_PADRAO,
  opcoesVisiveis,
  sheetFromParams,
  sheetModeloDe,
  sheetToParams,
  type Opcao,
  type Secao,
  type SheetConfig,
} from "@/lib/production-sheet-config";

const STORAGE_KEY = "precificai:producao-ficha";
const T = { teal: "#0F766E", deep: "#0B4D4B", lime: "#9ACB39", tint: "#E6F4F1", zebra: "#F3F8F7", muted: "#475569" };

/** Escolha lembrada neste aparelho (só conveniência: se o navegador bloquear, vale a ficha completa). */
function useSavedConfig(): [SheetConfig, (c: SheetConfig) => void] {
  const [config, setConfig] = useState<SheetConfig>({ secoes: [...SHEET_PADRAO.secoes], opcoes: { ...SHEET_PADRAO.opcoes } });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const [secoes, opcoes] = saved.split("|");
        const c = sheetFromParams(secoes, opcoes);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- ler o localStorage só é possível no navegador, depois da hidratação
        if (c.secoes.length > 0) setConfig(c);
      }
    } catch {}
  }, []);
  const save = (c: SheetConfig) => {
    setConfig(c);
    try {
      const p = sheetToParams(c);
      localStorage.setItem(STORAGE_KEY, `${p.secoes}|${p.opcoes}`);
    } catch {}
  };
  return [config, save];
}

/** Estado da janela: a ordem de TODAS as seções (com as desmarcadas no fim) e quais estão ligadas. */
type Draft = { ordem: Secao[]; ligadas: Record<Secao, boolean>; opcoes: Record<Opcao, boolean> };

const fromConfig = (c: SheetConfig): Draft => {
  const ligadas = Object.fromEntries(SECOES.map((s) => [s, c.secoes.includes(s)])) as Record<Secao, boolean>;
  return { ordem: [...c.secoes, ...SECOES.filter((s) => !c.secoes.includes(s))], ligadas, opcoes: { ...c.opcoes } };
};
const toConfig = (d: Draft): SheetConfig => ({ secoes: d.ordem.filter((s) => d.ligadas[s]), opcoes: d.opcoes });

/** Miniatura da ficha com dados de exemplo: muda na hora conforme as seções, a ordem e as opções. */
function Preview({ c }: { c: SheetConfig }) {
  const o = c.opcoes;
  const bar = (title: string) => (
    <p className="flex items-center gap-1 text-[10px] font-bold" style={{ color: T.teal }}>
      <span className="inline-block size-1.5 rounded-[2px]" style={{ background: T.lime }} />
      {title}
    </p>
  );
  const head = (cols: { t: string; w?: string; right?: boolean }[]) => (
    <div className="mt-1 flex items-center rounded px-1.5 py-1 text-[8px] font-bold text-white" style={{ background: T.teal }}>
      {cols.map((x) => (
        <span key={x.t} className={`${x.w ?? "flex-1"} ${x.right ? "text-right" : ""}`}>
          {x.t}
        </span>
      ))}
    </div>
  );
  const row = (i: number, cells: React.ReactNode[]) => (
    <div key={i} className="flex items-center px-1.5 py-1 text-[9px]" style={i % 2 === 0 ? { background: T.zebra } : undefined}>
      {cells}
    </div>
  );
  const box = <span className="mr-1.5 inline-block size-2.5 shrink-0 rounded-[3px] border border-slate-500" />;

  const blocks: Record<Secao, React.ReactNode> = {
    produzir: (
      <div className="mt-3">
        {bar("Produzir")}
        {head([{ t: "Produto" }, { t: "Fazer", w: "w-9", right: true }, ...(o.custoProduto ? [{ t: "Custo", w: "w-12", right: true }] : []), ...(o.saiu ? [{ t: "Saiu", w: "w-12", right: true }] : [])])}
        {[
          ["Escondidinho", "100", "R$ 950,00"],
          ["Filé de frango", "50", "R$ 400,00"],
        ].map((r, i) =>
          row(i, [
            <span key="a" className="flex-1">{r[0]}</span>,
            <span key="b" className="w-9 text-right font-bold">{r[1]}</span>,
            ...(o.custoProduto ? [<span key="c" className="w-12 text-right">{r[2]}</span>] : []),
            ...(o.saiu ? [<span key="d" className="ml-auto inline-block w-10 border-b border-slate-500" />] : []),
          ]),
        )}
      </div>
    ),
    preparar: (
      <div className="mt-3">
        {bar("Preparar")}
        <div className="mt-1 overflow-hidden rounded border" style={{ borderColor: "#CBD5E1" }}>
          <p className="flex justify-between px-1.5 py-1 text-[9px] font-bold" style={{ background: T.tint, color: T.deep }}>
            <span>Arroz cozido</span>
            <span className="font-normal" style={{ color: T.muted }}>18 kg prontos · 2 lotes</span>
          </p>
          {o.insumos ? row(0, [<span key="a" className="flex-1">Arroz</span>, <span key="b" className="font-bold">7,2 kg</span>]) : null}
        </div>
      </div>
    ),
    comprar: (
      <div className="mt-3">
        {bar("Comprar")}
        {o.fornecedor ? <p className="mt-1 text-[9px] font-bold" style={{ color: T.deep }}>Frigorífico Boi Bom</p> : null}
        {head([...(o.marcar ? [{ t: "OK", w: "w-4" }] : []), { t: "Item" }, { t: "Comprar", w: "w-14", right: true }, ...(o.estoque ? [{ t: "Tem", w: "w-9", right: true }] : []), ...(o.precos ? [{ t: "Preço", w: "w-14", right: true }, { t: "Total", w: "w-11", right: true }] : [])])}
        {[
          ["Patinho moído", "7 kg", "—", "R$ 40,00/kg", "R$ 280,00"],
          ["Peito de frango", "9 kg", "2 kg", "R$ 15,00/kg", "R$ 135,00"],
        ].map((r, i) =>
          row(i, [
            ...(o.marcar ? [<span key="m">{box}</span>] : []),
            <span key="a" className="flex-1">{r[0]}</span>,
            <span key="b" className="w-14 text-right">{r[1]}</span>,
            ...(o.estoque ? [<span key="c" className="w-9 text-right" style={{ color: T.muted }}>{r[2]}</span>] : []),
            ...(o.precos ? [<span key="d" className="w-14 text-right" style={{ color: T.muted }}>{r[3]}</span>, <span key="e" className="w-11 text-right font-bold">{r[4].replace("R$ ", "")}</span>] : []),
          ]),
        )}
        {o.precos ? (
          <p className="mt-1 flex justify-between rounded px-1.5 py-1 text-[9px] font-bold text-white" style={{ background: T.teal }}>
            <span>Compra estimada</span>
            <span>R$ 415,00</span>
          </p>
        ) : null}
      </div>
    ),
    observacoes: (
      <div className="mt-3">
        {bar("Observações")}
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-3.5 border-b border-dashed border-slate-300" />
        ))}
      </div>
    ),
  };

  return (
    <div className="w-[340px] rounded-md bg-white p-3 text-[#0F172A] shadow-md ring-1 ring-black/10" aria-label="Exemplo de como a ficha vai sair">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg text-sm font-black text-white" style={{ background: T.teal }}>P</span>
        <div className="leading-tight">
          <p className="text-[12px] font-bold" style={{ color: T.deep }}>Nome da sua empresa</p>
          <p className="text-[7px] uppercase tracking-widest" style={{ color: T.muted }}>Ficha de produção</p>
        </div>
      </div>
      <div className="mt-2 h-[3px] rounded" style={{ background: T.lime }} />
      <p className="mt-2 text-[15px] font-bold" style={{ color: T.deep }}>Produção de 09/11</p>
      {o.resumo ? (
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${c.secoes.includes("comprar") && o.precos ? 3 : c.secoes.includes("produzir") ? 2 : 1}, minmax(0, 1fr))` }}>
          {[
            { l: "Marmitas", v: "150" },
            ...(c.secoes.includes("produzir") || (c.secoes.includes("comprar") && o.precos) ? [{ l: "Custo de produzir", v: "R$ 1.350" }] : []),
            ...(c.secoes.includes("comprar") && o.precos ? [{ l: "Compra estimada", v: "R$ 415" }] : []),
          ].map((k) => (
            <div key={k.l} className="rounded-md px-1.5 py-1" style={{ background: T.tint }}>
              <p className="text-[6px] uppercase tracking-wider" style={{ color: T.muted }}>{k.l}</p>
              <p className="text-[11px] font-bold" style={{ color: T.deep }}>{k.v}</p>
            </div>
          ))}
        </div>
      ) : null}
      {c.secoes.map((s) => (
        <div key={s}>{blocks[s]}</div>
      ))}
      {c.secoes.length === 0 ? <p className="mt-4 text-center text-[10px]" style={{ color: T.muted }}>Marque alguma parte para ela aparecer aqui.</p> : null}
      <div className="mt-4 border-t border-slate-200 pt-1.5 text-center text-[8px] font-bold" style={{ color: T.teal }}>Precificaí · powered by Grupo Shogun</div>
    </div>
  );
}

/** A folha inteira, encolhida para caber na área (sem rolar), com a largura de papel de 340 px. */
function FitPreview({ c, height }: { c: SheetConfig; height: number }) {
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
    <div ref={box} className="relative w-full overflow-hidden" style={{ height }}>
      <div ref={page} className="absolute top-0 origin-top-left" style={{ left: fit.left, transform: `scale(${fit.scale})` }}>
        <Preview c={c} />
      </div>
    </div>
  );
}

const chip = (on: boolean) => `flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;

/** Janela do "Baixar ficha de produção": modelos prontos, as partes da ficha (ligar, desligar e mudar a ordem), opções e prévia ao vivo. */
export function ProducaoFichaModal({ planId, planName, onClose }: { planId: string; planName: string; onClose: () => void }) {
  const [saved, save] = useSavedConfig();
  const [draft, setDraft] = useState<Draft>(() => fromConfig(SHEET_PADRAO));
  const [touched, setTouched] = useState(false);
  const [grande, setGrande] = useState(false);

  // A escolha lembrada chega depois da hidratação; só vale se a pessoa ainda não mexeu.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- aplica a escolha lembrada neste aparelho
    if (!touched) setDraft(fromConfig(saved));
  }, [saved, touched]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const config = toConfig(draft);
  const modelo = sheetModeloDe(config);
  const change = (next: Draft) => {
    setTouched(true);
    setDraft(next);
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= draft.ordem.length) return;
    const ordem = [...draft.ordem];
    [ordem[i], ordem[to]] = [ordem[to], ordem[i]];
    change({ ...draft, ordem });
  };
  const params = sheetToParams(config);
  const visiveis = opcoesVisiveis(config);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 lg:items-center lg:p-4" role="dialog" aria-modal="true" aria-label="Baixar ficha de produção" onClick={onClose}>
      <div className="flex h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-surface lg:h-[85dvh] lg:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-border py-1 pl-4 pr-1">
          <div className="min-w-0">
            <p className="font-extrabold leading-tight">Baixar ficha de produção</p>
            <p className="truncate text-xs text-muted">{planName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-11 place-items-center rounded-full text-xl text-muted">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Prévia */}
          <div className="shrink-0 border-b border-border bg-black/5 px-3 pb-2 pt-3 lg:flex lg:flex-1 lg:flex-col lg:border-b-0 lg:border-r">
            <div className="lg:hidden">
              <FitPreview c={config} height={grande ? 460 : 250} />
            </div>
            <div className="hidden lg:block">
              <FitPreview c={config} height={520} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Exemplo com dados fictícios</p>
              <button type="button" onClick={() => setGrande((g) => !g)} className="h-9 rounded-full px-3 text-xs font-semibold text-primary lg:hidden">
                {grande ? "Reduzir prévia" : "Ampliar prévia"}
              </button>
            </div>
          </div>

          {/* Controles */}
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 lg:w-[380px] lg:flex-none">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Modelo pronto</p>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Modelo">
                {SHEET_MODELOS.map((m) => (
                  <button key={m.id} type="button" aria-pressed={modelo === m.id} onClick={() => change(fromConfig(m.config))} className={`min-h-12 rounded-xl border px-1 text-sm font-semibold leading-tight ${modelo === m.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface"}`}>
                    {m.nome}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">{modelo ? SHEET_MODELOS.find((m) => m.id === modelo)?.descricao : "Personalizada: ajuste as partes e a ordem abaixo."}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Partes e ordem</p>
              <p className="mb-1.5 text-xs text-muted">Marque o que entra e use as setas para mudar a ordem na folha.</p>
              <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {draft.ordem.map((s, i) => (
                  <li key={s} className="flex items-center gap-2 py-1 pl-3 pr-1">
                    <button type="button" role="switch" aria-checked={draft.ligadas[s]} aria-label={SECAO_LABEL[s]} onClick={() => change({ ...draft, ligadas: { ...draft.ligadas, [s]: !draft.ligadas[s] } })} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                      <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-md border text-sm font-bold ${draft.ligadas[s] ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-transparent"}`}>
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-sm font-semibold ${draft.ligadas[s] ? "" : "text-muted"}`}>{SECAO_LABEL[s]}</span>
                        <span className="block truncate text-xs text-muted">{SECAO_DICA[s]}</span>
                      </span>
                    </button>
                    <span className="flex shrink-0 gap-1">
                      <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Subir ${SECAO_LABEL[s]}`} className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-base disabled:opacity-30">
                        ↑
                      </button>
                      <button type="button" disabled={i === draft.ordem.length - 1} onClick={() => move(i, i + 1)} aria-label={`Descer ${SECAO_LABEL[s]}`} className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-base disabled:opacity-30">
                        ↓
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">O que mostrar</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {OPCOES.filter((o) => visiveis.includes(o)).map((o) => (
                  <button key={o} type="button" aria-pressed={draft.opcoes[o]} onClick={() => change({ ...draft, opcoes: { ...draft.opcoes, [o]: !draft.opcoes[o] } })} className={chip(draft.opcoes[o])}>
                    <span aria-hidden>{draft.opcoes[o] ? "✓" : "+"}</span>
                    {OPCAO_INFO[o].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {config.secoes.length === 0 ? (
            <p className="py-3 text-center text-sm font-semibold text-warning">Marque ao menos uma parte para baixar</p>
          ) : (
            <a
              href={`/producao/${planId}/ficha?secoes=${encodeURIComponent(params.secoes)}&opcoes=${encodeURIComponent(params.opcoes)}`}
              download
              onClick={() => {
                save(config);
                setTimeout(onClose, 400);
              }}
              className="flex h-12 items-center justify-center rounded-xl border border-primary bg-primary text-base font-semibold text-primary-foreground"
            >
              Baixar PDF
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
