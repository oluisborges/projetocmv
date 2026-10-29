import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/confirm-button";
import { requireMember } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { undoNfe } from "./actions";
import { NfeImporter } from "./nfe-importer";

export const metadata = { title: "Importar nota fiscal" };

export default async function NfePage() {
  const { orgId, canWrite } = await requireMember();
  if (!canWrite) redirect("/ingredientes");

  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("nfe_imports")
    .select("id, nfe_number, supplier_name, issued_at, total, added_to_purchases, changes")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <>
      <BackLink href="/ingredientes">Ingredientes</BackLink>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Importar nota fiscal</h1>
        <p className="text-muted">
          Comprou do fornecedor? Envie o arquivo XML da nota (ele manda por e-mail ou WhatsApp) e o Precificaí atualiza o preço dos seus insumos. Nada é salvo antes de você
          conferir.
        </p>
      </section>
      <NfeImporter />

      {(recent ?? []).length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Notas já importadas</h2>
          <ul className="divide-y divide-border card px-4">
            {(recent ?? []).map((n) => {
              const changed = Array.isArray(n.changes) ? n.changes.length : 0;
              return (
                <li key={n.id as string} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold leading-snug">{n.supplier_name as string}</p>
                    <p className="tabular text-sm text-muted">
                      Nota {(n.nfe_number as string | null) ?? "s/n"} · {new Date(n.issued_at as string).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {formatBRL(Number(n.total))} ·{" "}
                      {changed} {changed === 1 ? "preço mudou" : "preços mudaram"}
                      {Number(n.added_to_purchases) > 0 ? ` · ${formatBRL(Number(n.added_to_purchases))} nas compras` : ""}
                    </p>
                  </div>
                  <form action={undoNfe}>
                    <input type="hidden" name="id" value={n.id as string} />
                    <ConfirmButton
                      title="Desfazer esta importação?"
                      message="Os preços voltam ao que eram (se você não mexeu neles depois), os insumos criados pela nota são arquivados e o valor sai das compras do mês. A nota poderá ser importada de novo."
                      confirmLabel="Desfazer"
                      className="h-11 shrink-0 rounded-xl border border-border px-3 text-sm font-semibold"
                    >
                      Desfazer
                    </ConfirmButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
