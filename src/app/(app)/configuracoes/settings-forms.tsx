"use client";

import { ActionForm, TextField } from "@/components/forms";
import { changeOwnPassword, saveCompanyName, saveProfileName } from "./actions";

export function NameForm({ defaultName }: { defaultName: string }) {
  return (
    <ActionForm action={saveProfileName} submitLabel="Salvar meu nome">
      <TextField label="Seu nome" name="name" defaultValue={defaultName} autoComplete="name" />
    </ActionForm>
  );
}

export function CompanyForm({ defaultName }: { defaultName: string }) {
  return (
    <ActionForm action={saveCompanyName} submitLabel="Salvar nome da empresa">
      <TextField label="Nome da empresa" name="company" defaultValue={defaultName} autoComplete="organization" />
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changeOwnPassword} submitLabel="Trocar senha" resetOnOk>
      <TextField label="Senha atual" name="current" type="password" autoComplete="current-password" />
      <TextField label="Senha nova (mínimo 8 caracteres)" name="password" type="password" autoComplete="new-password" />
      <TextField label="Repita a senha nova" name="confirm" type="password" autoComplete="new-password" />
    </ActionForm>
  );
}
