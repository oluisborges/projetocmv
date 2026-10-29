import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createIngredient } from "../actions";
import { IngredientForm } from "../ingredient-form";

export const metadata = { title: "Novo item" };

export default async function NewIngredientPage(props: PageProps<"/ingredientes/novo">) {
  const { orgId, canWrite } = await requireMember();
  const { tipo } = await props.searchParams;
  const isPack = tipo === "embalagem";
  if (!canWrite) redirect("/ingredientes");

  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("category").eq("org_id", orgId).not("category", "is", null);
  const categories = [...new Set((data ?? []).map((r) => r.category as string))].sort();

  return (
    <>
      <BackLink href="/ingredientes">Ingredientes</BackLink>
      <h1 className="text-2xl font-extrabold tracking-tight">{isPack ? "Nova embalagem" : "Novo insumo"}</h1>
      <IngredientForm action={createIngredient} submitLabel={isPack ? "Salvar embalagem" : "Salvar insumo"} categories={categories} defaults={{ kind: isPack ? "embalagem" : "insumo" }} />
    </>
  );
}
