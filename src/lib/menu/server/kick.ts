import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { needsKick } from "../window";
import { dispatchRun } from "./dispatch";

type KickCandidate = Parameters<typeof needsKick>[0] & { id: string };

/**
 * Retoma importações paradas. Quem está olhando a tela do cardápio é o melhor sinal de que há trabalho esperando: se a corrente de
 * ciclos quebrou (função encerrada, falha passageira), o próximo acesso a recomeça, em vez de esperar o cron do dia seguinte.
 * Roda depois da resposta, então não atrasa a página. A rota de execução tem trava, então chamadas repetidas não duplicam trabalho.
 */
export async function kickStalled(connections: KickCandidate[]): Promise<void> {
  const stalled = connections.filter((c) => needsKick(c));
  if (stalled.length === 0) return;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return;
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  after(async () => {
    await Promise.all(stalled.map((c) => dispatchRun(origin, c.id)));
  });
}
