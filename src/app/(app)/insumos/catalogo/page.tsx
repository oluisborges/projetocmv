import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CatalogPicker, type CatalogItem, type CatalogRecipe } from "./catalog-picker";

export const metadata = { title: "Catálogo da Shogun" };

export default async function CatalogPage() {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  const supabase = await createClient();
  const [{ data: templates }, { data: mine }, { data: tplRecipes }, { data: tplItems }, { data: myRecipes }] = await Promise.all([
    supabase.from("template_ingredients").select("id, name, category, purchase_unit, purchase_qty").order("category").order("name"),
    supabase.from("ingredients").select("template_id").eq("org_id", orgId).not("template_id", "is", null),
    supabase.from("template_recipes").select("id, name, category").order("category").order("name"),
    supabase.from("template_recipe_items").select("template_recipe_id"),
    supabase.from("recipes").select("template_id").eq("org_id", orgId).not("template_id", "is", null),
  ]);

  const have = new Set((mine ?? []).map((r) => r.template_id as string));
  const haveRecipes = new Set((myRecipes ?? []).map((r) => r.template_id as string));
  const items: CatalogItem[] = (templates ?? []).map((t) => ({ ...t, imported: have.has(t.id) }));

  const counts = new Map<string, number>();
  for (const r of tplItems ?? []) counts.set(r.template_recipe_id as string, (counts.get(r.template_recipe_id as string) ?? 0) + 1);
  const recipes: CatalogRecipe[] = (tplRecipes ?? []).map((r) => ({ ...r, itemCount: counts.get(r.id) ?? 0, imported: haveRecipes.has(r.id) }));

  return (
    <>
      <Link href="/insumos" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Insumos
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Catálogo da Shogun</h1>
        <p className="text-muted">Marque o que você usa. Depois é só preencher o preço que você paga em cada item.</p>
        <p className="text-xs text-muted">Rendimentos e fatores de correção são valores médios de mercado: ajuste ao que você realmente usa.</p>
      </section>
      <CatalogPicker items={items} recipes={recipes} />
    </>
  );
}
