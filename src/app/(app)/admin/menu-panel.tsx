import { headers } from "next/headers";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyField } from "@/components/copy-field";
import { Reveal } from "@/components/reveal";
import { menuHealth, MENU_HEALTH_LABEL, type MenuHealth } from "@/lib/admin-overview";
import { PROVIDER_LABEL, type MenuProvider } from "@/lib/menu/types";
import { dateTimeBR, timeAgo } from "@/lib/relative-time";
import { ConnectMenuForm } from "./connect-menu-form";
import { disconnectMenu } from "./menu-actions";
import { SyncNowButton } from "./sync-now-button";

export type MenuConnectionRow = {
  id: string;
  provider: MenuProvider;
  status: "connected" | "error";
  phase: "history" | "done";
  merchant_name: string | null;
  store_code: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  orders_imported: number;
  pending_orders: number;
  webhook_token: string | null;
};

const HEALTH_STYLE: Record<MenuHealth, string> = {
  ok: "bg-success/10 text-success",
  importing: "bg-warning/10 text-warning",
  late: "bg-warning/10 text-warning",
  error: "bg-danger/10 text-danger",
};

/**
 * Aba "Cardápio" do painel de gerenciamento: uma ficha por cardápio conectado (situação, última leitura, atualizar, desconectar,
 * aviso automático) e, embaixo, o formulário de conexão. Nada de menu dentro de menu: o que é secundário abre no próprio lugar.
 */
export async function MenuPanel({ orgId, connections }: { orgId: string; connections: MenuConnectionRow[] }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const now = new Date();
  // Cardápio com erro (chave recusada ou desconectado): o caminho é reconectar, então o formulário já abre com o cardápio certo.
  const failing = connections.find((c) => menuHealth(c, now) === "error");

  return (
    <div className="flex flex-col gap-4 p-5">
      {connections.map((c) => {
        const health = menuHealth(c, now);
        const total = c.orders_imported + c.pending_orders;
        const progress = c.pending_orders > 0 && total > 0 ? Math.round((c.orders_imported / total) * 100) : null;
        return (
          <section key={c.id} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold">{PROVIDER_LABEL[c.provider]}</h3>
                <p className="truncate text-xs text-muted">
                  {[c.merchant_name, c.store_code ? `loja ${c.store_code}` : null].filter(Boolean).join(" · ") || "Loja sem nome informado"}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${HEALTH_STYLE[health]}`}>{MENU_HEALTH_LABEL[health]}</span>
            </header>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Última leitura</dt>
                <dd title={dateTimeBR(c.last_sync_at) || undefined}>{c.last_sync_at ? timeAgo(c.last_sync_at, now) : "ainda não puxou"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Pedidos importados</dt>
                <dd className="tabular">{new Intl.NumberFormat("pt-BR").format(c.orders_imported)}</dd>
              </div>
            </dl>

            {progress !== null ? (
              <div className="flex flex-col gap-1">
                <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Importação do histórico">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted">
                  Importando o histórico: {progress}% (faltam {c.pending_orders}). Continua sozinho.
                </p>
              </div>
            ) : null}

            {c.last_error ? (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {c.last_error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-start gap-2">
              {c.status === "connected" ? <SyncNowButton connectionId={c.id} /> : null}
              <form action={disconnectMenu}>
                <input type="hidden" name="connectionId" value={c.id} />
                <ConfirmButton
                  title="Desconectar este cardápio?"
                  message="A chave de API é apagada e a importação para. Os pedidos e vínculos já importados ficam guardados, e dá para conectar de novo depois."
                  confirmLabel="Desconectar"
                  className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-danger"
                >
                  Desconectar
                </ConfirmButton>
              </form>
            </div>

            {c.webhook_token && host ? (
              <Reveal label="Aviso automático de pedidos (opcional)" openLabel="Esconder aviso automático">
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-muted">
                    Faz o pedido chegar em segundos, sem esperar a leitura diária. Cadastre no painel do {PROVIDER_LABEL[c.provider]}.{" "}
                    {c.provider === "cardapioweb" ? "Use o endereço abaixo e envie o token no cabeçalho X-Webhook-Token." : "Use o endereço completo (o token já vai nele)."}
                  </p>
                  <CopyField label="Endereço" value={`${proto}://${host}/api/menu/webhook/${c.id}${c.provider === "prefiro" ? `?t=${c.webhook_token}` : ""}`} />
                  {c.provider === "cardapioweb" ? <CopyField label="Token (cabeçalho X-Webhook-Token)" value={c.webhook_token} /> : null}
                </div>
              </Reveal>
            ) : null}
          </section>
        );
      })}

      {connections.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-background/60 p-4">
          <h3 className="font-bold">Conectar o cardápio digital</h3>
          <p className="text-sm text-muted">Com o cardápio conectado, o sistema puxa as vendas sozinho e calcula o lucro real do cliente.</p>
        </div>
      ) : null}

      {connections.length === 0 ? (
        <ConnectMenuForm orgId={orgId} />
      ) : (
        <Reveal
          variant="primary"
          label={failing ? `Reconectar ${PROVIDER_LABEL[failing.provider]} com uma nova chave` : "Conectar outro cardápio ou reconectar"}
          openLabel="Fechar formulário"
          defaultOpen={Boolean(failing)}
        >
          <ConnectMenuForm orgId={orgId} defaultProvider={failing?.provider} />
        </Reveal>
      )}
    </div>
  );
}
