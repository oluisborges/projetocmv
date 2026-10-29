import Link from "next/link";

const btn = "flex h-12 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold";

/**
 * Os botões de criar da tela de Ingredientes: "+ Novo insumo" (embalagem também se escolhe lá, no campo Tipo)
 * e "+ Nova receita". As importações e o reajuste de preços ficam recolhidos em "Mais opções".
 */
export function NewSheet() {
  const link = "flex min-h-11 items-center px-2 text-sm font-semibold text-primary";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Link href="/ingredientes/novo" className={`${btn} bg-primary text-primary-foreground`}>
          + Novo insumo
        </Link>
        <Link href="/ingredientes/receitas/nova" className={`${btn} border border-primary bg-surface text-primary`}>
          + Nova receita
        </Link>
      </div>
      <details className="rounded-xl border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-muted">Mais opções</summary>
        <div className="flex flex-col border-t border-border px-2 pb-1">
          <Link href="/ingredientes/nfe" className={link}>
            Importar nota fiscal (XML)
          </Link>
          <Link href="/ingredientes/catalogo" className={link}>
            Importar do catálogo de insumos
          </Link>
          <Link href="/ingredientes/reajuste" className={link}>
            Reajustar vários preços de uma vez (%)
          </Link>
        </div>
      </details>
    </div>
  );
}
