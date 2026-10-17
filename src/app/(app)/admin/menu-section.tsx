import { headers } from "next/headers";
import { PROVIDER_LABEL, type MenuProvider } from "@/lib/menu/types";
import { isStale } from "@/lib/menu/window";
import { AdminForm, Field } from "./admin-form";
import { connectMenu, disconnectMenu, syncMenuNow } from "./menu-actions";

export type MenuConnectionRow = {
  id: string;
  provider: MenuProvider;
  status: "connected" | "error";
  phase: "history" | "done";
  merchant_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  orders_imported: number;
  webhook_token: string | null;
};

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

/** Bloco "Cardápio digital" de uma marmitaria no painel Shogun: o time conecta, testa e acompanha. A chave nunca volta para a tela. */
export async function MenuSection({ orgId, connections }: { orgId: string; connections: MenuConnectionRow[] }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";

  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Cardápio digital {connections.length > 0 ? `(${connections.length} conectado${connections.length > 1 ? "s" : ""})` : ""}
      </summary>
      <div className="flex flex-col gap-4 pt-3">
        {connections.map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-medium">
                {PROVIDER_LABEL[c.provider]}
                {c.merchant_name ? <span className="text-muted"> · {c.merchant_name}</span> : null}
              </p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${c.status !== "connected" ? "bg-danger/10 text-danger" : c.phase === "done" && isStale(c.last_sync_at) ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                {c.status !== "connected" ? "Com erro" : c.phase === "history" ? "Importando histórico" : isStale(c.last_sync_at) ? "Atrasado" : "Em dia"}
              </span>
            </div>
            <p className="text-xs text-muted">
              {c.orders_imported} pedidos importados · última sincronização {c.last_sync_at ? fmt.format(new Date(c.last_sync_at)) : "ainda não houve"}
            </p>
            {c.last_error ? (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                {c.last_error}
              </p>
            ) : null}

            {c.webhook_token && host ? (
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-primary">Aviso automático de pedidos (webhook)</summary>
                <div className="flex flex-col gap-1 pt-2 text-xs">
                  <p className="text-muted">
                    Cadastre no painel de {PROVIDER_LABEL[c.provider]}. {c.provider === "cardapioweb" ? "Informe a URL e use o token no cabeçalho X-Webhook-Token." : "Use a URL completa (o token já vai nela)."}
                  </p>
                  <code className="break-all rounded bg-background px-2 py-1">
                    {proto}://{host}/api/menu/webhook/{c.id}
                    {c.provider === "prefiro" ? `?t=${c.webhook_token}` : ""}
                  </code>
                  {c.provider === "cardapioweb" ? <code className="break-all rounded bg-background px-2 py-1">{c.webhook_token}</code> : null}
                </div>
              </details>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {c.status === "connected" ? (
                <div className="min-w-40 flex-1">
                  <AdminForm action={syncMenuNow} submitLabel="Sincronizar agora">
                    <input type="hidden" name="connectionId" value={c.id} />
                  </AdminForm>
                </div>
              ) : null}
              <div className="min-w-40 flex-1">
                <AdminForm action={disconnectMenu} submitLabel="Desconectar">
                  <input type="hidden" name="connectionId" value={c.id} />
                </AdminForm>
              </div>
            </div>
          </div>
        ))}

        <details>
          <summary className="cursor-pointer text-sm font-semibold text-primary">{connections.length > 0 ? "Conectar outro ou reconectar" : "Conectar cardápio"}</summary>
          <div className="pt-3">
            <AdminForm action={connectMenu} submitLabel="Testar e conectar">
              <input type="hidden" name="orgId" value={orgId} />
              <label className="flex flex-col gap-1 text-sm font-medium">
                Cardápio
                <select name="provider" defaultValue="cardapioweb" className="h-11 card px-3 text-base">
                  <option value="cardapioweb">CardápioWeb</option>
                  <option value="prefiro">Prefiro Delivery</option>
                </select>
              </label>
              <Field label="Chave de API" name="apiKey" type="password" />
              <Field label="Só Prefiro: hash do estabelecimento (ou a URL da API)" name="hash" />
              <p className="text-xs text-muted">
                CardápioWeb: o lojista gera a chave em Configurações → Integrações → API. Prefiro: hash e chave de API do painel. A chave fica só no servidor.
              </p>
            </AdminForm>
          </div>
        </details>
      </div>
    </details>
  );
}
