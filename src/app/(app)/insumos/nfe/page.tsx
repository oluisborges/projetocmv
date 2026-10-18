import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { NfeImporter } from "./nfe-importer";

export const metadata = { title: "Importar nota fiscal" };

export default async function NfePage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  return (
    <>
      <Link href="/insumos" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Insumos
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Importar nota fiscal</h1>
        <p className="text-muted">
          Comprou do fornecedor? Envie o arquivo XML da nota (ele manda por e-mail ou WhatsApp) e o Precificaí atualiza o preço dos seus insumos. Nada é salvo antes de você
          conferir.
        </p>
      </section>
      <NfeImporter />
    </>
  );
}
