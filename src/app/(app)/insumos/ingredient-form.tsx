"use client";

import { useState } from "react";
import { ActionForm, SelectField, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import type { FormState } from "./actions";

export type IngredientDefaults = {
  id?: string;
  name?: string;
  kind?: string;
  category?: string | null;
  purchase_unit?: string;
  purchase_qty?: number;
  purchase_price?: number;
  correction_factor?: number;
  /** Peso pronto ÷ peso cru: 2.5 = 1 kg cru vira 2,5 kg pronto. */
  cooking_yield?: number;
};

const decimal = (n: number | undefined) => (n === undefined ? undefined : String(n).replace(".", ","));

const inputClass =
  "h-12 w-full min-w-0 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Rendimento depois de pronto, perguntado do jeito da cozinha ("1 kg cru vira quantos kg?"), com a ajuda SEMPRE visível:
 * quem deixa 1 num arroz ou numa carne faz a ficha cobrar o dobro ou mais, e ninguém percebe.
 */
function YieldField({ defaultValue }: { defaultValue: number }) {
  const [value, setValue] = useState(decimal(defaultValue) ?? "1");
  const chip = (active: boolean) =>
    `h-11 rounded-full border px-4 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Depois de pronto, 1 kg (cru e limpo) vira quantos kg?
        <input name="cooking_yield" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" autoComplete="off" className={inputClass} />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Atalhos de rendimento">
        <button type="button" className={chip(value === "1")} onClick={() => setValue("1")}>
          Não muda (1)
        </button>
        <button type="button" className={chip(value === "2,5")} onClick={() => setValue("2,5")}>
          Cresce: arroz, feijão, massa
        </button>
        <button type="button" className={chip(value === "0,75")} onClick={() => setValue("0,75")}>
          Encolhe: carnes
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Arroz 2,5 · Feijão 2,2 · Macarrão 2,3 · Frango grelhado 0,75 · Carne moída 0,7 · Salada, molho, queijo 1. É assim que o app converte os gramas
        PRONTOS do produto para o que você compra cru.
      </p>
    </div>
  );
}

export function IngredientForm({
  action,
  submitLabel,
  defaults = {},
  categories,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaults?: IngredientDefaults;
  categories: string[];
}) {
  const [kind, setKind] = useState(defaults.kind ?? "insumo");

  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <TextField label="Nome" name="name" defaultValue={defaults.name} placeholder="Ex.: Peito de frango" />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Tipo
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="insumo">Insumo (comida)</option>
          <option value="embalagem">Embalagem (bandeja, filme, etiqueta…)</option>
        </select>
      </label>

      <TextField label="Categoria (opcional)" name="category" defaultValue={defaults.category ?? ""} required={false} list="categorias" placeholder="Ex.: Proteínas" />
      <datalist id="categorias">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Quanto vem na compra"
          name="purchase_qty"
          inputMode="decimal"
          defaultValue={decimal(defaults.purchase_qty) ?? "1"}
          hint={<Hint>Quantidade da embalagem que você compra. Saco de arroz de 5 kg: 5. Pacote com 100 bandejas: 100.</Hint>}
        />
        <SelectField
          label="Unidade"
          name="purchase_unit"
          defaultValue={defaults.purchase_unit ?? "kg"}
          options={[
            { value: "kg", label: "kg" },
            { value: "g", label: "g" },
            { value: "l", label: "litro" },
            { value: "ml", label: "ml" },
            { value: "un", label: "unidade" },
          ]}
        />
      </div>

      <TextField
        label="Quanto você paga (R$)"
        name="purchase_price"
        inputMode="decimal"
        defaultValue={defaults.purchase_price ? decimal(defaults.purchase_price) : ""}
        placeholder="Ex.: 14,50"
        hint={<Hint>O preço total dessa compra, o mesmo da nota. Se o saco de 5 kg custou R$ 30, digite 30.</Hint>}
      />

      {kind === "insumo" ? (
        <details open={!defaults.id} className="card">
          <summary className="flex min-h-14 cursor-pointer flex-col justify-center px-4 py-2 text-sm">
            <span className="font-semibold text-primary">Perdas e rendimento (avançado)</span>
            {defaults.id ? (
              <span className="text-xs text-muted">
                Compra {decimal(defaults.correction_factor) ?? "1"}× para aproveitar 1 · cru vira {decimal(defaults.cooking_yield) ?? "1"}× depois de pronto
              </span>
            ) : (
              <span className="text-xs text-muted">Se não tem perda nem muda de peso ao cozinhar, deixe 1.</span>
            )}
          </summary>
          <div className="flex flex-col gap-4 border-t border-border p-4">
        <TextField
          label="Perda na limpeza (fator de correção)"
          name="correction_factor"
          inputMode="decimal"
          defaultValue={decimal(defaults.correction_factor) ?? "1"}
          hint={
            <Hint>
              Quanto você precisa comprar para aproveitar 1 kg limpo. Frango com aparas e gordura: 1,15 (compra 1,15 kg para aproveitar 1 kg).
              Se não tem perda nenhuma, deixe 1.
            </Hint>
          }
        />
            <YieldField defaultValue={defaults.cooking_yield ?? 1} />
          </div>
        </details>
      ) : null}
    </ActionForm>
  );
}
