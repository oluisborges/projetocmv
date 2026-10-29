"use client";

import { useState } from "react";
import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { createRecipe } from "../actions";

export function NewRecipeForm() {
  const [mode, setMode] = useState<"serving" | "batch">("serving");

  return (
    <ActionForm action={createRecipe} submitLabel="Criar e adicionar ingredientes">
      <input type="hidden" name="mode" value={mode} />

      <TextField label="Nome do produto" name="name" placeholder="Ex.: Frango grelhado com arroz e feijão" />

      <p className="text-sm text-muted">
        {mode === "serving"
          ? "Você vai informar quanto vai em CADA unidade vendida (120 g de frango, 150 g de arroz…)."
          : "Receita em lote: você informa a receita toda e quantas unidades ela rende."}{" "}
        <button type="button" onClick={() => setMode(mode === "serving" ? "batch" : "serving")} className="tap-area font-semibold text-primary underline">
          {mode === "serving" ? "Faço em panela grande (lote)" : "Prefiro informar por unidade"}
        </button>
      </p>

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
