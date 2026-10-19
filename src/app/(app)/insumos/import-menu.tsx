"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/** Menu "Importar": fecha ao tocar fora, ao apertar Esc ou ao escolher uma opção. */
export function ImportMenu({ buttonClass }: { buttonClass: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      if (ref.current?.open && e.target instanceof Node && !ref.current.contains(e.target)) ref.current.open = false;
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && ref.current && (ref.current.open = false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  const item = "flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary active:bg-primary/10";
  return (
    <details ref={ref} className="group relative">
      <summary className={`${buttonClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Importar ▾</summary>
      <div className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-10 flex flex-col card p-1 shadow-xl">
        <Link href="/insumos/nfe" onClick={close} className={item}>
          Nota fiscal (XML)
        </Link>
        <Link href="/insumos/catalogo" onClick={close} className={item}>
          Escolher do catálogo de insumos
        </Link>
      </div>
    </details>
  );
}
