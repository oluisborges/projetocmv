// Regras puras do monitoramento de erros (sem banco, sem rede).

export type ErrorSource = "server" | "client" | "sync";

export type ErrorInfo = { message: string; stack: string | null; digest: string | null };

/** Lê qualquer coisa que tenha sido lançada. Nunca lança. */
export function describeError(err: unknown): ErrorInfo {
  if (err instanceof Error) {
    return { message: err.message || err.name || "Erro sem mensagem", stack: err.stack ?? null, digest: digestOf(err) };
  }
  if (typeof err === "string") return { message: err || "Erro sem mensagem", stack: null, digest: null };
  try {
    return { message: JSON.stringify(err) ?? "Erro desconhecido", stack: null, digest: digestOf(err) };
  } catch {
    return { message: "Erro desconhecido", stack: null, digest: null };
  }
}

function digestOf(err: unknown): string | null {
  return typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
}

/**
 * Redirecionamento e "página não encontrada" também chegam como erro no Next, mas são o funcionamento normal do app.
 * Também ignora o que o navegador solta por conta própria e que não é falha nossa.
 */
export function shouldIgnoreError(err: unknown): boolean {
  const { message, digest } = describeError(err);
  if (digest && (digest.startsWith("NEXT_REDIRECT") || digest.includes("NEXT_HTTP_ERROR_FALLBACK") || digest.includes("NEXT_NOT_FOUND"))) return true;
  if (message === "NEXT_REDIRECT" || message === "NEXT_NOT_FOUND") return true;
  if (/ResizeObserver loop|AbortError|Failed to fetch|Load failed|NetworkError when attempting/i.test(message)) return true; // rede do usuário
  return false;
}

/** Tira o que muda a cada ocorrência (ids, números, endereços) para erros iguais caírem no mesmo grupo. */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b\d{3,}\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Troca ids de rota por um marcador: "/admin/uso/123" e "/admin/uso/456" são a mesma página. */
export function normalizePath(path: string | null | undefined): string {
  if (!path) return "";
  return path
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n");
}

/** Texto que identifica o tipo de erro (o servidor transforma em hash). */
export function fingerprintKey(source: ErrorSource, message: string, path?: string | null): string {
  return [source, normalizeMessage(message), normalizePath(path)].join("|");
}
