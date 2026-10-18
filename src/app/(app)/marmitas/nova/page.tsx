import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { NewRecipeForm } from "./new-recipe-form";

export const metadata = { title: "Nova ficha" };

export default async function NewRecipePage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/marmitas");

  return (
    <>
      <Link href="/marmitas" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Fichas
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Nova ficha técnica</h1>
        <p className="text-muted">Primeiro o básico. Os ingredientes você adiciona na próxima tela.</p>
      </section>

      <NewRecipeForm />
    </>
  );
}
