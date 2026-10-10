"use client";

import { useState } from "react";
import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { createRecipe } from "../actions";

const choice = (active: boolean) =>
  `flex min-h-14 flex-1 flex-col justify-center gap-0.5 rounded-xl border px-4 py-2 text-left ${
    active ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-surface"
  }`;

export function NewRecipeForm() {
  const [mode, setMode] = useState<"serving" | "batch">("serving");

  return (
    <ActionForm action={createRecipe} submitLabel="Criar e adicionar ingredientes">
      <input type="hidden" name="mode" value={mode} />

      <TextField label="Nome do produto" name="name" placeholder="Ex.: Frango grelhado com arroz e feijão" />

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-sm font-medium">Como você monta essa receita?</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setMode("serving")} aria-pressed={mode === "serving"} className={choice(mode === "serving")}>
            <span className="font-semibold">Por unidade</span>
            <span className="text-xs text-muted">Quanto vai em CADA unidade vendida: 120 g de frango, 150 g de arroz… (recomendado)</span>
          </button>
          <button type="button" onClick={() => setMode("batch")} aria-pressed={mode === "batch"} className={choice(mode === "batch")}>
            <span className="font-semibold">Em lote</span>
            <span className="text-xs text-muted">Uma panela ou receita grande que rende várias unidades</span>
          </button>
        </div>
      </fieldset>

      {mode === "batch" ? (
        <>
          <TextField
            label="Rende quantas porções"
            name="portions"
            inputMode="decimal"
            required={false}
            placeholder="Ex.: 25"
            hint={<Hint>Quantas unidades saem dessa receita. Preencha este campo OU o peso de cada porção; o outro a gente calcula.</Hint>}
          />
          <TextField
            label="Peso da porção (g)"
            name="portion_weight"
            inputMode="decimal"
            required={false}
            placeholder="Ex.: 300"
            hint={<Hint>Quanto pesa cada unidade pronta, em gramas. Se você preencher só este, as porções saem do peso total depois de cozinhar.</Hint>}
          />
          <TextField
            label="Perda de cocção (%)"
            name="cooking_loss"
            inputMode="decimal"
            required={false}
            placeholder="Ex.: 25"
            hint={<Hint>Quanto a comida perde de peso ao cozinhar (água e gordura). Frango grelhado costuma perder cerca de 25%. Se não souber, deixe em branco.</Hint>}
          />
        </>
      ) : null}
    </ActionForm>
  );
}
