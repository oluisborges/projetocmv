import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SheetImporter } from "./sheet-importer";

export const metadata = { title: "Importar planilha" };

export default async function SheetPage(props: PageProps<"/admin/planilha">) {
  await requireAdmin();
  const { org } = await props.searchParams;
  const id = z.uuid().safeParse(typeof org === "string" ? org : "");
  if (!id.success) redirect("/admin");
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("id, name").eq("id", id.data).maybeSingle();
  if (!data) redirect("/admin");

  return (
    <>
      <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Painel Shogun
      </Link>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Importar planilha</h1>
        <p className="rounded-xl bg-primary/10 px-3 py-2 text-sm">
          Importando para <strong>{data.name as string}</strong>. Confira a prévia antes de salvar: os dados entram direto na conta do cliente.
        </p>
        <p className="text-muted">Baixe o modelo, cole os dados do cliente e envie. Aceita .xlsx (várias abas) e .csv.</p>
      </section>
      <SheetImporter orgId={data.id as string} />
    </>
  );
}
