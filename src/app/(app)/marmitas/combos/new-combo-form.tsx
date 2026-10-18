"use client";

import { ActionForm, TextField } from "@/components/forms";
import { createCombo } from "./actions";

export function NewComboForm() {
  return (
    <ActionForm action={createCombo} submitLabel="Criar combo e montar">
      <TextField label="Nome do combo" name="name" placeholder="Ex.: Kit 10 marmitas, Semanal, Combo casal" />
    </ActionForm>
  );
}
