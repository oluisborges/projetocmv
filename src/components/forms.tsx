"use client";

import { startTransition, useActionState, useRef, useSyncExternalStore } from "react";
import { PendingLabel } from "@/components/spinner";

const subscribe = () => () => {};
/** false no servidor e no primeiro render, true depois que a página carregou no navegador. */
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

type State = { error?: string; ok?: string };

/**
 * Formulário com mensagem de erro/sucesso. O envio é feito à mão (startTransition) de propósito: com
 * `<form action={fn}>` o React 19 limpa todos os campos até quando a ação devolve erro, e o dono perderia o que digitou.
 * `resetOnOk`: limpa os campos só quando salvou com sucesso (formulários de "adicionar").
 */
export function ActionForm({
  action,
  submitLabel,
  resetOnOk = false,
  children,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  resetOnOk?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const hydrated = useHydrated();
  const [state, formAction, pending] = useActionState(async (prev: State, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.ok && resetOnOk) ref.current?.reset();
    return result;
  }, {} as State);

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="flex flex-col gap-4"
    >
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
        disabled={pending || !hydrated}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? <PendingLabel>Salvando…</PendingLabel> : submitLabel}
      </button>
    </form>
  );
}

const inputClass =
  "h-12 card px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function TextField({
  label,
  name,
  defaultValue,
  inputMode,
  required = true,
  placeholder,
  hint,
  list,
  type = "text",
  autoComplete = "off",
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  inputMode?: "decimal" | "text" | "numeric";
  required?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
  list?: string;
  type?: "text" | "password";
  autoComplete?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      <span>
        {label}
        {hint}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode={inputMode}
        required={required}
        placeholder={placeholder}
        list={list}
        type={type}
        autoComplete={autoComplete}
        className={`${inputClass} w-full min-w-0`}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">
      {label}
      <select name={name} defaultValue={defaultValue} className={`${inputClass} w-full min-w-0`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
