import Link from "next/link";
import type { MenuAlert } from "@/lib/admin-overview";

/**
 * Aviso para a equipe Shogun, no topo de qualquer tela: cardápios que pararam de importar.
 * Erro (chave recusada ou desconectado) é vermelho; atraso é âmbar. Leva ao painel, onde se resolve.
 */
export function AdminAlertBanner({ alerts }: { alerts: MenuAlert[] }) {
  if (alerts.length === 0) return null;
  const errors = alerts.filter((a) => a.health === "error").length;
  return (
    <div role="alert" className={`flex flex-col gap-2 rounded-2xl border p-3 text-sm ${errors > 0 ? "border-danger/40 bg-danger/10" : "border-warning/40 bg-warning/10"}`}>
      <p className="font-semibold">
        {alerts.length} {alerts.length === 1 ? "cardápio parou de importar" : "cardápios pararam de importar"}
      </p>
      <ul className="flex flex-col gap-0.5">
        {alerts.slice(0, 3).map((a) => (
          <li key={a.connectionId} className="leading-snug">
            {a.text}
          </li>
        ))}
        {alerts.length > 3 ? <li className="text-muted">e mais {alerts.length - 3}</li> : null}
      </ul>
      <Link href="/admin" className="flex h-11 items-center justify-center self-start rounded-lg border border-border bg-surface px-4 font-semibold text-primary">
        Resolver no painel
      </Link>
    </div>
  );
}
