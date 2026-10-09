"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
