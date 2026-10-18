import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { SheetImporter } from "./sheet-importer";

export const metadata = { title: "Importar planilha" };

export default async function SheetPage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  return (
    <>
      <Link href="/insumos" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Insumos
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Importar planilha</h1>
        <p className="text-muted">Já tem seus insumos ou fichas numa planilha do Excel? Baixe o modelo, cole os seus dados e envie. Você confere tudo antes de salvar.</p>
      </section>
      <SheetImporter />
    </>
  );
}
