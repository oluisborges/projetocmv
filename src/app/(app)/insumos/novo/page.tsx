import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createIngredient } from "../actions";
import { IngredientForm } from "../ingredient-form";

export const metadata = { title: "Novo insumo" };

export default async function NewIngredientPage() {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("category").eq("org_id", orgId).not("category", "is", null);
  const categories = [...new Set((data ?? []).map((r) => r.category as string))].sort();

  return (
    <>
      <BackLink href="/insumos">Insumos</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">Novo insumo</h1>
      <IngredientForm action={createIngredient} submitLabel="Salvar insumo" categories={categories} />
    </>
  );
}
