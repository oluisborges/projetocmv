import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeError, fingerprintKey, shouldIgnoreError, type ErrorSource } from "./describe";

/** Mesmo erro repetido em rajada (ex.: uma página quebrada recarregada várias vezes) grava no máximo uma vez a cada 5 s por instância. */
const recent = new Map<string, number>();
const THROTTLE_MS = 5_000;

type Where = { path?: string | null; routeType?: string | null; orgId?: string | null };

/**
 * Grava um erro no monitoramento. NUNCA lança: o monitoramento não pode derrubar o que está monitorando.
 * Erros iguais (mesma origem, mensagem e rota) viram uma linha só, com contagem.
 */
export async function recordError(source: ErrorSource, err: unknown, where: Where = {}): Promise<void> {
  try {
    if (shouldIgnoreError(err)) return;
    const { message, stack } = describeError(err);
    const key = fingerprintKey(source, message, where.path);
    const fingerprint = createHash("sha1").update(key).digest("hex");

    const now = Date.now();
    if (now - (recent.get(fingerprint) ?? 0) < THROTTLE_MS) return;
    recent.set(fingerprint, now);
    if (recent.size > 500) recent.clear();

    await createAdminClient().rpc("log_error", {
      p_fingerprint: fingerprint,
      p_source: source,
      p_message: message,
      p_stack: stack,
      p_path: where.path ?? null,
      p_route_type: where.routeType ?? null,
      p_org_id: where.orgId ?? null,
    });
  } catch {
    // sem banco ou sem chave de serviço (ex.: ambiente local): perde o registro, nunca o app
  }
}
