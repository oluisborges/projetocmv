"use client";

import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { createReceita } from "../actions";

/** Receita nova: o nome e quanto ela rende pronta. Os ingredientes entram na tela seguinte. */
export function NewReceitaForm() {
  return (
    <ActionForm action={createReceita} submitLabel="Criar e adicionar ingredientes">
      <TextField label="Nome da receita" name="name" placeholder="Ex.: Arroz branco" />
      <div className="flex flex-col gap-1.5 text-sm font-medium">
        <label htmlFor="ready-weight">
          Quanto rende pronta (peso total depois de cozida)
          <Hint>O peso de tudo que sai do lote, já cozido. Se 5 kg de arroz cru viram 12,5 kg de arroz pronto, digite 12,5 e escolha kg.</Hint>
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            id="ready-weight"
            name="ready_weight"
            inputMode="decimal"
            placeholder="Ex.: 12,5"
            required
            className="h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <select name="ready_unit" defaultValue="kg" aria-label="Unidade do peso" className="h-12 card px-3 text-base outline-none focus:border-primary">
            <option value="kg">kg</option>
            <option value="g">g</option>
          </select>
        </div>
      </div>
    </ActionForm>
  );
}
