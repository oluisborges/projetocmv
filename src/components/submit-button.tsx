"use client";

import { useFormStatus } from "react-dom";
import { PendingLabel } from "./spinner";

/** Botão de enviar de um `<form action={...}>`: enquanto a ação roda, trava e mostra rodinha + texto. */
export function SubmitButton({
  children,
  pendingLabel = "Aguarde…",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:opacity-70`}>
      {pending ? <PendingLabel>{pendingLabel}</PendingLabel> : children}
    </button>
  );
}
