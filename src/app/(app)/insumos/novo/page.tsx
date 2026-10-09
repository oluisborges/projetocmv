import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createIngredient } from "../actions";
import { IngredientForm } from "../ingredient-form";

export const metadata = { title: "Novo insumo" };

export default async function NewIngredientPage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("category").not("category", "is", null);
  const categories = [...new Set((data ?? []).map((r) => r.category as string))].sort();

  return (
    <>
      <Link href="/insumos" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Insumos
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">Novo insumo</h1>
      <IngredientForm action={createIngredient} submitLabel="Salvar insumo" categories={categories} />
    </>
  );
}
