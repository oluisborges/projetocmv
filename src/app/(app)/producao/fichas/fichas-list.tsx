"use client";

import { useEffect, useMemo, useState } from "react";
import { CAMPOS_PADRAO, MODELOS, camposFromParam, camposToParam, modeloDe, type FichaCampos } from "@/lib/ficha-campos";
import { PersonalizarModal } from "./personalizar-modal";
import type { FichaOption } from "@/lib/ficha-tecnica-data";

const STORAGE_KEY = "precificai:ficha-campos";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
type Filter = "todas" | "marmita" | "receita";

const TAG_LABEL = { insumo: "Ingrediente", receita: "Receita", embalagem: "Embalagem" } as const;
const TAG_STYLE = { insumo: "bg-primary/10 text-primary", receita: "bg-warning/10 text-warning", embalagem: "bg-black/10 text-muted" } as const;

const download = "flex h-11 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold";

/** Escolher um produto ou receita e baixar a ficha técnica em PDF e/ou Excel. */
export function FichasList({ options }: { options: FichaOption[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [aberto, setAberto] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const [campos, setCampos] = useState<FichaCampos>({ ...CAMPOS_PADRAO });

  // Lembra a escolha neste aparelho (só conveniência: se o navegador bloquear, segue com o padrão).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ler o localStorage só é possível no navegador, depois da hidratação
      if (saved !== null) setCampos(camposFromParam(saved));
    } catch {}
  }, []);
  const escolher = (next: FichaCampos) => {
    setCampos(next);
    try {
      localStorage.setItem(STORAGE_KEY, camposToParam(next));
    } catch {}
  };
  const modelo = modeloDe(campos);
  const camposParam = encodeURIComponent(camposToParam(campos));

  const counts = useMemo(() => ({ todas: options.length, marmita: options.filter((o) => o.kind === "marmita").length, receita: options.filter((o) => o.kind === "receita").length }), [options]);
  const q = norm(query);
  const shown = options.filter((o) => (filter === "todas" || o.kind === filter) && (q === "" || norm(o.name).includes(q)));
  const chip = (on: boolean) => `h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">O que vai na ficha</p>
            <p className="font-semibold">{modelo ? `Modelo ${MODELOS.find((m) => m.id === modelo)?.nome}` : "Personalizada"}</p>
            <p className="text-xs text-muted">{camposToParam(campos) === "" ? "Nenhum campo marcado" : `${camposToParam(campos).split(",").length} campos marcados`}</p>
          </div>
          <button type="button" onClick={() => setAberto(true)} className="h-11 shrink-0 rounded-xl border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Personalizar
          </button>
        </div>
      </div>
      {aberto ? <PersonalizarModal campos={campos} onApply={escolher} onClose={() => setAberto(false)} /> : null}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar produto ou receita…"
        aria-label="Buscar"
        className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo">
        <button type="button" aria-pressed={filter === "todas"} onClick={() => setFilter("todas")} className={chip(filter === "todas")}>
          Todas ({counts.todas})
        </button>
        <button type="button" aria-pressed={filter === "marmita"} onClick={() => setFilter("marmita")} className={chip(filter === "marmita")}>
          Produtos ({counts.marmita})
        </button>
        <button type="button" aria-pressed={filter === "receita"} onClick={() => setFilter("receita")} className={chip(filter === "receita")}>
          Receitas ({counts.receita})
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="card p-4 text-sm text-muted">Nada encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((o) => (
            <li key={o.id} className="flex flex-col gap-3 card p-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" aria-expanded={open.has(o.id)} onClick={() => toggle(o.id)} className="tap-area flex min-w-0 flex-1 items-start gap-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{o.name}</span>
                    <span className="block text-xs text-muted">
                      {o.kind === "receita" ? "Receita" : "Produto"}
                      {o.category ? ` · ${o.category}` : ""}
                      {` · ${o.items.length} ${o.items.length === 1 ? "item" : "itens"}`}
                    </span>
                  </span>
                  <span aria-hidden className={`mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition-transform ${open.has(o.id) ? "rotate-180" : ""}`}>
                    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 8 5 5 5-5" />
                    </svg>
                  </span>
                </button>
                {!o.complete ? <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">custo incompleto</span> : null}
              </div>
              {open.has(o.id) ? (
                o.items.length === 0 ? (
                  <p className="rounded-lg bg-black/5 px-3 py-2 text-xs text-muted">Ainda sem itens.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border rounded-lg bg-black/5 px-3 py-1 text-sm">
                    {o.items.map((it, i) => (
                      <li key={`${it.name}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0 truncate">{it.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TAG_STYLE[it.tag]}`}>{TAG_LABEL[it.tag]}</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
              <div className="flex gap-2">
                <a href={`/producao/fichas/baixar?id=${o.id}&formato=pdf&campos=${camposParam}`} download className={`${download} border-primary bg-primary text-primary-foreground`}>
                  Baixar PDF
                </a>
                <a href={`/producao/fichas/baixar?id=${o.id}&formato=xlsx&campos=${camposParam}`} download className={`${download} border-border bg-surface`}>
                  Baixar Excel
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
