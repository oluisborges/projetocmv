import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { loadErrors, type ErrorRow } from "@/lib/errors/data";
import { dateTimeBR, timeAgo } from "@/lib/relative-time";
import { AdminTabs } from "../admin-tabs";
import { resolveAllErrors, resolveError } from "./actions";

export const metadata = { title: "Erros do sistema" };

const SOURCE_LABEL: Record<ErrorRow["source"], string> = { server: "Servidor", client: "Tela do cliente", sync: "Importação do cardápio" };

function ErrorCard({ e, now, resolved = false }: { e: ErrorRow; now: Date; resolved?: boolean }) {
  return (
    <article className={`flex flex-col gap-2 card p-4 ${resolved ? "opacity-70" : ""}`}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="rounded-full bg-border px-2 py-0.5 font-semibold">{SOURCE_LABEL[e.source]}</span>
        <span className="tabular rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger">{e.count}×</span>
        {e.orgName ? <span className="text-muted">{e.orgName}</span> : null}
      </header>
      <p className="break-words font-semibold leading-snug">{e.message}</p>
      <p className="text-xs text-muted">
        {e.path ? <span className="break-all">{e.path} · </span> : null}
        última vez <span title={dateTimeBR(e.lastSeen) || undefined}>{timeAgo(e.lastSeen, now)}</span> · primeira {timeAgo(e.firstSeen, now)}
      </p>
      {e.stack ? (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">Ver detalhes técnicos</summary>
          <pre className="max-h-64 overflow-auto rounded-lg bg-background p-3 text-[11px] leading-snug">{e.stack}</pre>
        </details>
      ) : null}
      {resolved ? (
        <p className="text-xs text-success">Resolvido {timeAgo(e.resolvedAt, now)}</p>
      ) : (
        <form action={resolveError}>
          <input type="hidden" name="id" value={e.id} />
          <SubmitButton pendingLabel="Salvando…" className="h-11 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-primary">
            Marcar como resolvido
          </SubmitButton>
        </form>
      )}
    </article>
  );
}

export default async function ErrorsPage() {
  await requireAdmin();
  const { open, resolved } = await loadErrors();
  const now = new Date();

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Shogun</h1>
        <p className="text-muted">O que quebrou no sistema, agrupado por tipo e com quantas vezes aconteceu.</p>
      </section>

      <AdminTabs active="errors" errorCount={open.length} />

      {open.length === 0 ? (
        <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
          <strong>Nenhum erro em aberto.</strong> Quando algo quebrar no servidor, numa tela ou na importação do cardápio, aparece aqui.
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Em aberto ({open.length})</h2>
            <form action={resolveAllErrors}>
              <ConfirmButton
                title="Dar baixa em todos?"
                message="Todos os erros em aberto saem da lista. Se algum acontecer de novo, ele volta sozinho."
                confirmLabel="Dar baixa em todos"
                destructive={false}
                className="h-11 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-primary"
              >
                Dar baixa em todos
              </ConfirmButton>
            </form>
          </div>
          {open.map((e) => (
            <ErrorCard key={e.id} e={e} now={now} />
          ))}
        </section>
      )}

      {resolved.length > 0 ? (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">Resolvidos nos últimos 7 dias ({resolved.length})</summary>
          <div className="flex flex-col gap-3 pt-2">
            {resolved.map((e) => (
              <ErrorCard key={e.id} e={e} now={now} resolved />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
