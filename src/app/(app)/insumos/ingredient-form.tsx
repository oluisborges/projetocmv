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
  /** fator: 2.5 = 250% */
  cooking_yield?: number;
};

const decimal = (n: number | undefined) => (n === undefined ? undefined : String(n).replace(".", ","));

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
          className="h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
        <TextField
          label="Rendimento depois de pronto (%)"
          name="cooking_yield_pct"
          inputMode="decimal"
          required={false}
          defaultValue={defaults.cooking_yield ? String(Number((defaults.cooking_yield * 100).toFixed(1))).replace(".", ",") : "100"}
          hint={
            <Hint>
              Quanto o item pesa depois de pronto, comparado ao que você pesou cru e limpo. Arroz: 250% (1 kg cru vira 2,5 kg cozido). Frango grelhado: 75%. Salada ou item
              que você já pesa cru na marmita: 100%.
            </Hint>
          }
        />
      ) : null}

      {kind === "insumo" ? (
        <TextField
          label="Fator de correção"
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
      ) : null}
    </ActionForm>
  );
}
