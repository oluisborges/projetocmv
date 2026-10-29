import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { requireMember } from "@/lib/auth";
import { NewReceitaForm } from "./new-receita-form";

export const metadata = { title: "Nova receita" };

export default async function NewReceitaPage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/ingredientes");

  return (
    <>
      <BackLink href="/ingredientes">Insumos</BackLink>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Nova receita</h1>
        <p className="text-muted">
          Algo que você faz em lote e usa em várias marmitas (arroz, feijão, estrogonofe, purê). Primeiro o nome e quanto rende; os ingredientes você adiciona na próxima tela.
        </p>
      </section>

      <NewReceitaForm />
    </>
  );
}
