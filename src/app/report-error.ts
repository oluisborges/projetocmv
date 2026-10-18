"use server";

import { getSession } from "@/lib/auth";
import { recordError } from "@/lib/errors/record";

/**
 * Erros que acontecem no navegador (a tela quebrou ao desenhar). Só aceita quem está logado, corta tudo e o banco agrupa em uma
 * linha por tipo (com teto), então não dá para encher a tabela nem escrever outra coisa além de uma mensagem curta.
 */
export async function reportClientError(message: string, stack: string | null, path: string | null): Promise<void> {
  if (!(await getSession())) return;
  const clip = (s: string | null, n: number) => (typeof s === "string" ? s.slice(0, n) : null);
  const err = new Error(clip(message, 300) ?? "Erro na tela");
  err.stack = clip(stack, 3000) ?? undefined;
  await recordError("client", err, { path: clip(path, 200), routeType: "client" });
}
