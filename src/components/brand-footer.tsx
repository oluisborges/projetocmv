import Image from "next/image";

/** Assinatura da marca, só nas telas "de vitrine" (Início e Painel): nas telas de edição só atrapalharia a rolagem. */
export function BrandFooter() {
  return (
    <footer className="mt-4 flex flex-col items-center gap-1.5 pt-2 text-center">
      <Image src="/brand/logo-stacked.png" alt="Grupo Shogun" width={560} height={359} className="h-14 w-auto opacity-90" />
      <p className="text-xs text-muted">Shogun Precificação · uma ferramenta do Grupo Shogun</p>
    </footer>
  );
}
