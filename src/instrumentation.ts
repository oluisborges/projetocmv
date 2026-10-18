import type { Instrumentation } from "next";

/**
 * Todo erro do servidor (página, rota, ação, proxy) passa por aqui. Vai para o monitoramento do painel Shogun (aba Erros).
 * Só roda no Node: a chave de serviço não existe no edge.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("./lib/errors/record");
  await recordError("server", err, { path: request.path, routeType: context.routeType });
};
