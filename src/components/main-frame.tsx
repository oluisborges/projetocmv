"use client";

import { usePathname } from "next/navigation";
import { WIDTH_CLASS, widthFor } from "@/lib/layout-width";

/** O miolo da página. No celular é a coluna de sempre; no desktop a largura segue o tipo de tela (formulário, lista ou painel). */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <main className={`mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10 ${WIDTH_CLASS[widthFor(pathname)]}`}>{children}</main>;
}
