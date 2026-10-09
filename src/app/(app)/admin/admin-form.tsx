"use client";

import { useActionState, useRef } from "react";
import type { AdminState } from "./actions";

type Props = {
  action: (prev: AdminState, formData: FormData) => Promise<AdminState>;
  submitLabel: string;
  children: React.ReactNode;
};

/** Formulário do painel: mostra erro/sucesso e limpa os campos (incluindo a senha) quando dá certo. */
export function AdminForm({ action, submitLabel, children }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: AdminState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok) ref.current?.reset();
    return result;
  }, {} as AdminState);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      {children}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          {state.ok}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete = "off",
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={type === "password" ? "new-password" : autoComplete}
        autoCapitalize="none"
        className="h-11 rounded-xl border border-border bg-surface px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
