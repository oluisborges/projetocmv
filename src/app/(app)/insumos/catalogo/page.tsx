import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CatalogPicker, type CatalogItem } from "./catalog-picker";

export const metadata = { title: "Catálogo da Shogun" };

export default async function CatalogPage() {
  const { canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  const supabase = await createClient();
  const [{ data: templates }, { data: mine }] = await Promise.all([
    supabase.from("template_ingredients").select("id, name, category, purchase_unit, purchase_qty").order("category").order("name"),
    supabase.from("ingredients").select("template_id").not("template_id", "is", null),
  ]);

  const have = new Set((mine ?? []).map((r) => r.template_id as string));
  const items: CatalogItem[] = (templates ?? []).map((t) => ({ ...t, imported: have.has(t.id) }));

  return (
    <>
      <Link href="/insumos" className="text-sm font-semibold text-primary">
        ← Insumos
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Catálogo da Shogun</h1>
        <p className="text-muted">Marque o que você usa. Depois é só preencher o preço que você paga em cada item.</p>
      </section>
      <CatalogPicker items={items} />
    </>
  );
}
