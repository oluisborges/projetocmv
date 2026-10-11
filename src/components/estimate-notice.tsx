import Link from "next/link";

/** Aviso de que os lucros ainda são estimativa, dizendo o que falta e levando direto para onde preencher. */
export function EstimateNotice({ reason, className = "" }: { reason: "tax" | "expenses" | null; className?: string }) {
  if (!reason) return null;
  return (
    <p role="status" className={`rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning ${className}`}>
      <strong>Estimativa:</strong>{" "}
      {reason === "tax" ? "faltam os impostos e as despesas." : "as contas fixas ainda não entraram nas margens (falta o faturamento mensal, ou elas passam dele)."}{" "}
      <Link href={reason === "tax" ? "/precificacao/ajustes" : "/custos"} className="font-semibold underline">
        {reason === "tax" ? "Informar nos Ajustes" : "Ver em Custos"}
      </Link>
    </p>
  );
}
