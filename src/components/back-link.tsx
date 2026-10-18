import Link from "next/link";

/** "← Ajustes": volta para a tela de origem. Mesmo visual em todas as telas internas. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
      ← {children}
    </Link>
  );
}
