import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdjustForm } from "./reajuste-form";

export const metadata = { title: "Reajustar preços" };

export default async function AdjustPage() {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) redirect("/insumos");

  const supabase = await createClient();
  const { data } = await supabase.from("ingredients").select("category").eq("org_id", orgId).is("archived_at", null).gt("purchase_price", 0);

  // Insumos sem categoria só entram em "Todos".
  const counts = new Map<string, number>();
  for (const r of data ?? []) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const categories = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <>
      <BackLink href="/insumos">Insumos</BackLink>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Reajustar preços</h1>
        <p className="text-muted">O fornecedor aumentou tudo? Atualize vários preços de uma vez, sem editar um por um.</p>
      </section>
      <AdjustForm categories={categories} total={(data ?? []).length} />
    </>
  );
}
