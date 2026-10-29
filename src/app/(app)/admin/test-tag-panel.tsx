import { setOrgTest } from "./actions";
import { AdminForm } from "./admin-form";

/** Aba "Geral" do Gerenciar: a marca de cliente de teste. */
export function TestTagPanel({ orgId, isTest }: { orgId: string; isTest: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Cliente de teste {isTest ? <span className="ml-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">Marcado</span> : null}</p>
        <p className="text-sm text-muted">
          Uma conta de teste não aparece em nenhuma estatística global, resultado da rede, alerta ou contagem de erros do painel. Ela continua na lista de clientes, com a marca &ldquo;Teste&rdquo;.
        </p>
      </div>
      <AdminForm action={setOrgTest} submitLabel={isTest ? "Remover a marca de teste" : "Marcar como cliente de teste"}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="test" value={isTest ? "0" : "1"} />
      </AdminForm>
    </div>
  );
}
