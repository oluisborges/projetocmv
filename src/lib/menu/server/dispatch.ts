import "server-only";

/**
 * Pede a uma função própria (uma por conexão) que rode um ciclo. Cada conexão roda na sua invocação, com o seu orçamento de tempo
 * e o seu limite de chamadas ao provedor: 30 clientes não esperam na fila uns dos outros. A rota responde 202 na hora e trabalha
 * depois da resposta (`after`), então quem despacha não fica preso.
 */
export async function dispatchRun(origin: string, connectionId: string, depth = 0): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(`${origin}/api/menu/run/${connectionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "x-chain-depth": String(depth) },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return res.status === 202;
  } catch {
    return false;
  }
}
