"use client";

import { useActionState } from "react";

type State = { error?: string; ok?: string };

export function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {} as State);

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}

const inputClass =
  "h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function TextField({
  label,
  name,
  defaultValue,
  inputMode,
  required = true,
  placeholder,
  hint,
  list,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  inputMode?: "decimal" | "text" | "numeric";
  required?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
  list?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
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
        autoComplete="off"
        className={inputClass}
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
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
