import "server-only";

/**
 * Pede a uma função própria (uma por conexão) que rode um ciclo. Cada conexão roda na sua invocação, com o seu orçamento de tempo
 * e o seu limite de chamadas ao provedor: 30 clientes não esperam na fila uns dos outros. A rota responde 202 na hora e trabalha
 * depois da resposta (`after`), então quem despacha não fica preso.
 */
export async function dispatchRun(origin: string, connectionId: string, depth = 0): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  origin = dispatchOrigin(origin);
  // duas tentativas: uma falha passageira de rede não pode quebrar a corrente de ciclos
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${origin}/api/menu/run/${connectionId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "x-chain-depth": String(depth) },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 202) return true;
      console.warn(JSON.stringify({ menu: "dispatch", connectionId, depth, attempt, status: res.status }));
    } catch (e) {
      console.warn(JSON.stringify({ menu: "dispatch", connectionId, depth, attempt, error: e instanceof Error ? e.message : String(e) }));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * Em produção, sempre pelo domínio de produção: o cron da Vercel chega pelo endereço único do deploy, que fica atrás do login
 * da Vercel (proteção de deploy) e recusa a chamada interna. O domínio de produção é público.
 */
export function dispatchOrigin(origin: string, env: Record<string, string | undefined> = process.env): string {
  const prod = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  return prod ? `https://${prod}` : origin;
}
