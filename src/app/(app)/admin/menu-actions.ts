"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { parseHash } from "@/lib/menu/prefiro";
import { cardapiowebClient, prefiroClient, AuthError, TransientError } from "@/lib/menu/server/http";
import { dispatchRun } from "@/lib/menu/server/dispatch";
import { lockConnection, runConnection } from "@/lib/menu/server/sync";
import { menuLookbackStart, shouldChain } from "@/lib/menu/window";
import { PROVIDER_LABEL } from "@/lib/menu/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminState } from "./actions";

const UUID = z.uuid();
const SYNC_BUDGET_MS = 50_000;

const failure = (error: string): AdminState => ({ error });

/** Endereço público do app nesta requisição (para a conexão chamar a própria função de sincronização). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Conecta (ou reconecta) o cardápio de uma marmitaria. Só admin Shogun. Testa a chave antes de gravar;
 * a chave nunca volta para o navegador. Reconectar mantém pedidos e vínculos já feitos.
 */
export async function connectMenu(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();

  const parsed = z
    .object({
      orgId: UUID,
      provider: z.enum(["cardapioweb", "prefiro"]),
      apiKey: z.string().trim().min(4, "Cole a chave de API.").max(400),
      hash: z.string().trim().max(400).optional(),
      storeCode: z.string().trim().max(60).optional(),
    })
    .safeParse({
      orgId: formData.get("orgId"),
      provider: formData.get("provider"),
      apiKey: formData.get("apiKey"),
      hash: formData.get("hash") || undefined,
      storeCode: formData.get("storeCode") || undefined,
    });
  if (!parsed.success) return failure(parsed.error.issues[0]?.message && parsed.error.issues[0].message !== "Invalid input" ? parsed.error.issues[0].message : "Confira os campos e tente de novo.");
  const { orgId, provider, apiKey } = parsed.data;

  // Cada cardápio pede a chave de API e mais um dado: o CardápioWeb, o código da loja; a Prefiro, a hash do estabelecimento.
  let storeCode: string | null = null;
  if (provider === "cardapioweb") {
    storeCode = parsed.data.storeCode?.trim() || null;
    if (!storeCode) return failure("Informe o código da loja no CardápioWeb.");
  }
  let hash: string | null = null;
  if (provider === "prefiro") {
    hash = parseHash(parsed.data.hash ?? "");
    if (!hash) return failure("A hash do estabelecimento é a mesma do painel da Prefiro (letras e números, sem espaços).");
  }

  // valida as credenciais antes de gravar qualquer coisa
  let merchant: string | null = null;
  try {
    if (provider === "cardapioweb") {
      const cw = cardapiowebClient(apiKey);
      await cw.ping();
      merchant = (await cw.merchant())?.name ?? null;
    } else {
      const r = await prefiroClient(hash!, apiKey).ping();
      if (!r.ok) return failure(`A Prefiro respondeu HTTP ${r.status} ao testar a conexão: ${r.raw}`);
      merchant = r.name;
    }
  } catch (e) {
    if (e instanceof AuthError) return failure(e.message);
    const detail = e instanceof Error ? e.message : String(e);
    // Erro 5xx em todos os testes: a chave não foi recusada, o CardápioWeb é que está falhando para essa loja.
    if (e instanceof TransientError && /(^|\D)5\d\d(\D|$)/.test(detail)) {
      return failure(
        `O ${PROVIDER_LABEL[provider]} devolveu erro interno (500) em todos os testes. A chave não foi recusada: o problema está do lado deles. Tente de novo em alguns minutos; se continuar, confira com o cliente se a integração por API está ativada (Configurações → Integrações → API) e peça ajuda ao suporte do CardápioWeb. Detalhe: ${detail.slice(0, 280)}`,
      );
    }
    return failure(`Não foi possível falar com ${PROVIDER_LABEL[provider]}: ${detail}`);
  }

  const db = createAdminClient();
  const { data: unit } = await db.from("units").select("id").eq("org_id", orgId).order("created_at").limit(1).maybeSingle();
  if (!unit) return failure("Essa marmitaria ainda não tem unidade.");

  const { data: existing } = await db.from("menu_connections").select("id").eq("unit_id", unit.id).eq("provider", provider).maybeSingle();
  let connectionId = existing?.id as string | undefined;
  if (connectionId) {
    await db.from("menu_connections").update({ status: "connected", last_error: null, merchant_name: merchant, store_code: storeCode, locked_until: null }).eq("id", connectionId);
  } else {
    const { data: created, error } = await db
      .from("menu_connections")
      // carga inicial: o mês atual e os 3 anteriores, inteiros
      .insert({ org_id: orgId, unit_id: unit.id, provider, merchant_name: merchant, store_code: storeCode, lookback_from: menuLookbackStart().toISOString() })
      .select("id")
      .single();
    if (error || !created) return failure("Não foi possível criar a conexão.");
    connectionId = created.id as string;
  }

  // o token do webhook é mantido se já existia (o cardápio já está configurado com ele)
  const { data: cur } = await db.from("menu_credentials").select("webhook_token").eq("connection_id", connectionId).maybeSingle();
  const { error: credError } = await db.from("menu_credentials").upsert({
    connection_id: connectionId,
    org_id: orgId,
    api_key: apiKey,
    config: hash ? { hash } : storeCode ? { store_code: storeCode } : {},
    webhook_token: (cur?.webhook_token as string | undefined) ?? randomBytes(24).toString("hex"),
  });
  if (credError) return failure("Não foi possível guardar a chave.");

  // começa a carga já: ela roda sozinha, em ciclos, na própria função desta conexão
  const started = await dispatchRun(await requestOrigin(), connectionId);
  revalidatePath("/admin");
  const base = `${PROVIDER_LABEL[provider]} conectado${merchant ? ` (${merchant})` : ""}.`;
  if (!started) return { ok: `${base} Não consegui iniciar a importação sozinha (falta a variável CRON_SECRET na Vercel). Toque em “Atualizar agora” para importar.` };
  return { ok: `${base} A importação dos últimos 4 meses começou e continua sozinha; acompanhe o status aqui.` };
}

/** Roda um ciclo agora (até ~50 s). A carga do histórico continua sozinha nos ciclos seguintes. */
export async function syncMenuNow(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const id = UUID.safeParse(formData.get("connectionId"));
  if (!id.success) return failure("Conexão inválida.");

  const db = createAdminClient();
  if (!(await lockConnection(db, id.data, SYNC_BUDGET_MS))) return failure("Já existe uma sincronização em andamento. Aguarde um minuto.");
  const r = await runConnection(db, id.data, Date.now() + SYNC_BUDGET_MS);
  // sobrou trabalho (histórico ou fila)? continua sozinho em outra função, sem o admin precisar clicar de novo
  if (shouldChain({ phase: r.phase, pending: r.pending, progressed: r.progressed, error: Boolean(r.error), depth: 0 })) await dispatchRun(await requestOrigin(), id.data, 1);
  revalidatePath("/admin");
  if (r.error) return failure(r.error);
  return { ok: r.phase === "history" ? `${r.ordersSaved} pedidos importados. A carga dos últimos 4 meses continua sozinha.` : `Em dia. ${r.ordersSaved} pedidos conferidos.` };
}

/**
 * Desconecta: apaga a chave e a fila. Os pedidos e vínculos já importados ficam (ajudam se reconectar).
 * Usada pelo botão com confirmação (formulário simples, sem estado).
 */
export async function disconnectMenu(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = UUID.safeParse(formData.get("connectionId"));
  if (!id.success) return;

  const db = createAdminClient();
  await db.from("menu_credentials").delete().eq("connection_id", id.data);
  await db.from("menu_order_queue").delete().eq("connection_id", id.data);
  await db.from("menu_connections").update({ status: "error", last_error: "Desconectado. Conecte de novo para voltar a importar.", locked_until: null }).eq("id", id.data);
  revalidatePath("/admin");
}
