"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Escolha do mês em pílulas rolantes; ao abrir, o mês atual da tela é centralizado na lista. */
export function MonthChips({ months, current, basePath }: { months: string[]; current: string; basePath: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);

  return (
    <div ref={ref} role="group" aria-label="Escolher o mês" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {months.map((m) => {
        const [y, mm] = m.split("-").map(Number);
        const on = m === current;
        return (
          <Link
            key={m}
            href={`${basePath}?mes=${m.slice(0, 7)}`}
            aria-current={on ? "page" : undefined}
            className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}
          >
            {SHORT[mm - 1]}/{String(y).slice(2)}
          </Link>
        );
      })}
    </div>
  );
}
