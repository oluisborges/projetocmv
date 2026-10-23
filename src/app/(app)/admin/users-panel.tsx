import { Reveal } from "@/components/reveal";
import { addMember, changeUserEmail, resetPassword, setUserBlocked } from "./actions";
import { AdminForm, Field } from "./admin-form";

export type UserRow = { id: string; name: string; email: string; role: "owner" | "manager" | "viewer"; blocked: boolean };

const ROLE_LABEL: Record<UserRow["role"], string> = { owner: "Dono", manager: "Gerente", viewer: "Só leitura" };

/** Aba "Usuários" do painel de gerenciamento: quem tem acesso, trocar senha (abre no próprio lugar) e adicionar usuário. */
export function UsersPanel({ orgId, users }: { orgId: string; users: UserRow[] }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <ul className="flex flex-col divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-1 py-3 first:pt-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-semibold">{u.name}</p>
              <span className="flex shrink-0 gap-1.5">
                {u.blocked ? <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Bloqueado</span> : null}
                <span className="rounded-full bg-border/70 px-2 py-0.5 text-xs">{ROLE_LABEL[u.role]}</span>
              </span>
            </div>
            <p className="truncate text-sm text-muted">{u.email}</p>
            <Reveal label="Trocar e-mail" openLabel="Cancelar troca de e-mail">
              <AdminForm action={changeUserEmail} submitLabel="Salvar novo e-mail">
                <input type="hidden" name="userId" value={u.id} />
                <Field label="Novo e-mail (será o login)" name="email" type="email" />
              </AdminForm>
            </Reveal>
            <Reveal label="Trocar senha" openLabel="Cancelar troca de senha">
              <AdminForm action={resetPassword} submitLabel="Salvar nova senha">
                <input type="hidden" name="userId" value={u.id} />
                <Field label="Nova senha (mínimo 8 caracteres)" name="password" type="password" />
              </AdminForm>
            </Reveal>
            <Reveal label={u.blocked ? "Liberar acesso" : "Bloquear acesso"} openLabel="Cancelar">
              <AdminForm action={setUserBlocked} submitLabel={u.blocked ? "Liberar acesso agora" : "Bloquear acesso agora"}>
                <input type="hidden" name="userId" value={u.id} />
                <input type="hidden" name="blocked" value={u.blocked ? "0" : "1"} />
                <p className="text-sm text-muted">
                  {u.blocked ? "A pessoa volta a poder entrar com o mesmo e-mail e senha." : "A pessoa deixa de entrar e perde o acesso na hora. Os dados da marmitaria ficam guardados."}
                </p>
              </AdminForm>
            </Reveal>
          </li>
        ))}
        {users.length === 0 ? <li className="py-3 text-sm text-muted">Nenhum usuário ainda.</li> : null}
      </ul>

      <Reveal variant="primary" label="Adicionar usuário" openLabel="Fechar formulário">
        <AdminForm action={addMember} submitLabel="Adicionar usuário">
          <input type="hidden" name="orgId" value={orgId} />
          <Field label="Nome" name="name" />
          <Field label="E-mail (será o login)" name="email" type="email" />
          <Field label="Senha (mínimo 8 caracteres)" name="password" type="password" />
          <label className="flex flex-col gap-1 text-sm font-medium">
            Papel
            <select name="role" defaultValue="manager" className="h-11 card px-3 text-base">
              <option value="manager">Gerente (edita)</option>
              <option value="owner">Dono (edita e gerencia)</option>
              <option value="viewer">Só leitura</option>
            </select>
          </label>
        </AdminForm>
      </Reveal>
    </div>
  );
}
