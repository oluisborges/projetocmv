import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMember, createOrganization, resetPassword } from "./actions";
import { AdminForm, Field } from "./admin-form";

export const metadata = { title: "Painel Shogun" };

const ROLE_LABEL: Record<string, string> = { owner: "Dono", manager: "Gerente", viewer: "Só leitura" };

export default async function AdminPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: orgs }, { data: memberships }, { data: usersPage }] = await Promise.all([
    admin.from("organizations").select("id, name, slug, created_at").order("name"),
    admin.from("memberships").select("org_id, user_id, role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const users = new Map((usersPage?.users ?? []).map((u) => [u.id, u]));

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Shogun</h1>
        <p className="text-muted">Crie a marmitaria do cliente e a senha de acesso. Depois passe e-mail e senha para ele.</p>
      </section>

      <details className="rounded-xl border border-border bg-surface p-4" open={(orgs?.length ?? 0) === 0}>
        <summary className="cursor-pointer text-base font-semibold">Nova marmitaria</summary>
        <div className="pt-4">
          <AdminForm action={createOrganization} submitLabel="Criar marmitaria">
            <Field label="Nome da marmitaria" name="orgName" />
            <Field label="Nome da primeira unidade" name="unitName" />
            <Field label="Nome do dono" name="ownerName" />
            <Field label="E-mail do dono (será o login)" name="ownerEmail" type="email" autoComplete="off" />
            <Field label="Senha (mínimo 8 caracteres)" name="ownerPassword" type="password" />
          </AdminForm>
        </div>
      </details>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Marmitarias ({orgs?.length ?? 0})
        </h2>
        {(orgs ?? []).map((org) => {
          const members = (memberships ?? []).filter((m) => m.org_id === org.id);
          return (
            <article key={org.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <header>
                <h3 className="text-lg font-bold">{org.name}</h3>
                <p className="text-xs text-muted">{members.length} usuário(s)</p>
              </header>

              <ul className="flex flex-col divide-y divide-border">
                {members.map((m) => {
                  const u = users.get(m.user_id);
                  const name = (u?.user_metadata?.full_name as string | undefined) ?? u?.email ?? m.user_id;
                  return (
                    <li key={m.user_id} className="flex flex-col gap-2 py-3 first:pt-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{name}</p>
                        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs">{ROLE_LABEL[m.role]}</span>
                      </div>
                      <p className="truncate text-sm text-muted">{u?.email}</p>
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold text-primary">Trocar senha</summary>
                        <div className="pt-3">
                          <AdminForm action={resetPassword} submitLabel="Salvar nova senha">
                            <input type="hidden" name="userId" value={m.user_id} />
                            <Field label="Nova senha (mínimo 8 caracteres)" name="password" type="password" />
                          </AdminForm>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>

              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">Adicionar usuário</summary>
                <div className="pt-3">
                  <AdminForm action={addMember} submitLabel="Adicionar usuário">
                    <input type="hidden" name="orgId" value={org.id} />
                    <Field label="Nome" name="name" />
                    <Field label="E-mail (será o login)" name="email" type="email" />
                    <Field label="Senha (mínimo 8 caracteres)" name="password" type="password" />
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Papel
                      <select
                        name="role"
                        defaultValue="manager"
                        className="h-11 rounded-xl border border-border bg-surface px-3 text-base"
                      >
                        <option value="manager">Gerente (edita)</option>
                        <option value="owner">Dono (edita e gerencia)</option>
                        <option value="viewer">Só leitura</option>
                      </select>
                    </label>
                  </AdminForm>
                </div>
              </details>
            </article>
          );
        })}
      </section>
    </>
  );
}
