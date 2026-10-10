"use client";

import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { changePassword } from "./actions";

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} submitLabel="Salvar nova senha">
      <TextField
        label="Nova senha"
        name="password"
        type="password"
        autoComplete="new-password"
        hint={<Hint>Pelo menos 8 caracteres. Misture letras e números e não use a senha de outros sites.</Hint>}
      />
      <TextField label="Repita a nova senha" name="confirm" type="password" autoComplete="new-password" />
    </ActionForm>
  );
}
