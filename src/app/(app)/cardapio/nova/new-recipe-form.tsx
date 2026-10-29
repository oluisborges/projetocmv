"use client";

import { ActionForm, TextField } from "@/components/forms";
import { createRecipe } from "../actions";

export function NewRecipeForm() {
  return (
    <ActionForm action={createRecipe} submitLabel="Criar e adicionar ingredientes">
      <input type="hidden" name="mode" value="serving" />

      <TextField label="Nome do produto" name="name" placeholder="Ex.: Frango grelhado com arroz e feijão" />
    </ActionForm>
  );
}
