import Image from "next/image";

/** Assinatura da marca, só nas telas "de vitrine" (Início e Painel): nas telas de edição só atrapalharia a rolagem. */
export function BrandFooter() {
  return (
    <footer className="mt-4 flex flex-col items-center gap-1.5 pt-2 text-center">
      <Image src="/brand/logo-powered-by-shogun.svg" alt="Precificaí, powered by Grupo Shogun" width={635} height={178} className="h-11 w-auto" />
    </footer>
  );
}
