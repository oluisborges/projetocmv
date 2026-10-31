"use client";

import { useEffect, useMemo, useState } from "react";
import { CAMPOS_PADRAO, CAMPO_GRUPOS, CAMPO_LABEL, MODELOS, camposFromParam, camposToParam, modeloDe, type FichaCampo, type FichaCampos } from "@/lib/ficha-campos";
import type { FichaOption } from "@/lib/ficha-tecnica-data";

const STORAGE_KEY = "precificai:ficha-campos";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
type Filter = "todas" | "marmita" | "receita";

const download = "flex h-11 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold";

/** Escolher um produto ou receita e baixar a ficha técnica em PDF e/ou Excel. */
export function FichasList({ options }: { options: FichaOption[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
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
  const nenhum = camposToParam(campos) === "";

  const counts = useMemo(() => ({ todas: options.length, marmita: options.filter((o) => o.kind === "marmita").length, receita: options.filter((o) => o.kind === "receita").length }), [options]);
  const q = norm(query);
  const shown = options.filter((o) => (filter === "todas" || o.kind === filter) && (q === "" || norm(o.name).includes(q)));
  const chip = (on: boolean) => `h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground"}`;

  return (
    <section className="flex flex-col gap-3">
      <div className="card flex flex-col gap-3 p-4">
        <div>
          <p className="font-semibold">O que vai na ficha</p>
          <p className="text-xs text-muted">Escolha um modelo e, se quiser, ajuste os campos. Vale para o PDF e para o Excel.</p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modelo">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={modelo === m.id}
              onClick={() => escolher({ ...m.campos })}
              className={`min-h-11 rounded-xl border px-3 py-2 text-left ${modelo === m.id ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
            >
              <span className="block text-sm font-semibold">{m.nome}</span>
              <span className="block text-xs leading-snug text-muted">{m.descricao}</span>
            </button>
          ))}
        </div>
        <details className="group">
          <summary className="tap-area flex cursor-pointer items-center justify-between text-sm font-semibold text-primary">
            <span>{modelo ? `Ajustar campos (modelo ${MODELOS.find((m) => m.id === modelo)?.nome})` : "Ajustar campos (personalizada)"}</span>
          </summary>
          <div className="mt-2 flex flex-col gap-4">
            {CAMPO_GRUPOS.map((g) => (
              <fieldset key={g.titulo} className="flex flex-col gap-1">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted">{g.titulo}</legend>
                {g.dica ? <p className="text-xs text-muted">{g.dica}</p> : null}
                {g.campos.map((c: FichaCampo) => (
                  <label key={c} className="tap-area flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={campos[c]} onChange={(e) => escolher({ ...campos, [c]: e.target.checked })} className="size-5 accent-[var(--color-primary)]" />
                    {CAMPO_LABEL[c]}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </details>
        {nenhum ? <p className="text-xs font-semibold text-warning">Nenhum campo marcado: a ficha sai só com o nome. Marque ao menos um.</p> : null}
      </div>

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
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{o.name}</p>
                  <p className="text-xs text-muted">
                    {o.kind === "receita" ? "Receita" : "Produto"}
                    {o.category ? ` · ${o.category}` : ""}
                  </p>
                </div>
                {!o.complete ? <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">custo incompleto</span> : null}
              </div>
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
