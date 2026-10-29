import { Reveal } from "@/components/reveal";
import { requireAdmin } from "@/lib/auth";
import { countOpenErrors } from "@/lib/errors/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetPassword, setUserBlocked } from "../actions";
import { AdminForm, Field } from "../admin-form";
import { AdminTabs } from "../admin-tabs";
import { createStaffUser, setStaffAccess, setStaffRole } from "./actions";

export const metadata = { title: "Equipe Shogun" };

const badge = "rounded-full px-2 py-0.5 text-xs font-semibold";

export default async function StaffPage() {
  const me = await requireAdmin();
  const admin = createAdminClient();

  const [{ data: staffRows }, { data: usersPage }, { data: orgs }, { data: access }] = await Promise.all([
    admin.from("profiles").select("id, full_name, is_platform_admin, staff_role, blocked_at").or("is_platform_admin.eq.true,staff_role.eq.manager"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("organizations").select("id, name, is_test").order("name"),
    admin.from("staff_org_access").select("user_id, org_id"),
  ]);
  const emails = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const allowed = new Map<string, Set<string>>();
  for (const a of access ?? []) allowed.set(a.user_id as string, new Set([...(allowed.get(a.user_id as string) ?? []), a.org_id as string]));

  const staff = (staffRows ?? [])
    .map((p) => ({
      id: p.id as string,
      name: (p.full_name as string | null) || emails.get(p.id as string) || "Sem nome",
      email: emails.get(p.id as string) ?? "",
      admin: Boolean(p.is_platform_admin),
      blocked: Boolean(p.blocked_at),
    }))
    .sort((a, b) => Number(b.admin) - Number(a.admin) || a.name.localeCompare(b.name, "pt-BR"));

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Painel Shogun</h1>
        <p className="text-muted">Quem da equipe Shogun usa o sistema. Admin vê e edita tudo; gestor só visualiza os clientes que você liberar.</p>
      </section>

      <AdminTabs active="team" errorCount={await countOpenErrors()} />

      <ul className="flex flex-col gap-3">
        {staff.map((p) => {
          const mine = allowed.get(p.id) ?? new Set<string>();
          return (
            <li key={p.id} className="flex flex-col gap-2 card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">
                  {p.name}
                  {p.id === me.userId ? <span className="font-normal text-muted"> (você)</span> : null}
                </p>
                <span className="flex shrink-0 gap-1.5">
                  {p.blocked ? <span className={`${badge} bg-danger/10 text-danger`}>Bloqueado</span> : null}
                  <span className={`${badge} ${p.admin ? "bg-primary text-primary-foreground" : "bg-border/70"}`}>{p.admin ? "Admin" : "Gestor"}</span>
                </span>
              </div>
              <p className="truncate text-sm text-muted">{p.email}</p>
              {!p.admin ? (
                <p className="text-xs text-muted">
                  {mine.size === 0 ? "Nenhum cliente liberado ainda." : `${mine.size} ${mine.size === 1 ? "cliente liberado" : "clientes liberados"}.`}
                </p>
              ) : null}

              {!p.admin ? (
                <Reveal label="Clientes liberados" openLabel="Fechar lista">
                  <AdminForm action={setStaffAccess} submitLabel="Salvar clientes liberados">
                    <input type="hidden" name="userId" value={p.id} />
                    <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto">
                      {(orgs ?? []).map((o) => (
                        <li key={o.id as string}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                            <input type="checkbox" name="orgIds" value={o.id as string} defaultChecked={mine.has(o.id as string)} className="size-5 accent-[var(--color-primary)]" />
                            <span className="min-w-0 flex-1 truncate">{o.name as string}</span>
                            {o.is_test ? <span className={`${badge} bg-warning/10 text-warning`}>Teste</span> : null}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </AdminForm>
                </Reveal>
              ) : null}

              {p.id !== me.userId ? (
                <Reveal label={p.admin ? "Tornar gestor" : "Tornar admin"} openLabel="Cancelar">
                  <AdminForm action={setStaffRole} submitLabel={p.admin ? "Tornar gestor" : "Tornar admin"}>
                    <input type="hidden" name="userId" value={p.id} />
                    <input type="hidden" name="role" value={p.admin ? "manager" : "admin"} />
                    <p className="text-sm text-muted">
                      {p.admin ? "A pessoa deixa de editar e passa a ver só os clientes que você liberar." : "A pessoa passa a ver e editar todos os clientes e a equipe."}
                    </p>
                  </AdminForm>
                </Reveal>
              ) : null}
              <Reveal label="Trocar senha" openLabel="Cancelar troca de senha">
                <AdminForm action={resetPassword} submitLabel="Salvar nova senha">
                  <input type="hidden" name="userId" value={p.id} />
                  <Field label="Nova senha (mínimo 8 caracteres)" name="password" type="password" />
                </AdminForm>
              </Reveal>
              {p.id !== me.userId && !p.admin ? (
                <Reveal label={p.blocked ? "Liberar acesso" : "Bloquear acesso"} openLabel="Cancelar">
                  <AdminForm action={setUserBlocked} submitLabel={p.blocked ? "Liberar acesso agora" : "Bloquear acesso agora"}>
                    <input type="hidden" name="userId" value={p.id} />
                    <input type="hidden" name="blocked" value={p.blocked ? "0" : "1"} />
                    <p className="text-sm text-muted">{p.blocked ? "A pessoa volta a poder entrar." : "A pessoa deixa de entrar e perde o acesso na hora."}</p>
                  </AdminForm>
                </Reveal>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Reveal variant="primary" label="+ Nova pessoa da equipe" openLabel="Fechar formulário">
        <AdminForm action={createStaffUser} submitLabel="Criar usuário">
          <Field label="Nome" name="name" />
          <Field label="E-mail (será o login)" name="email" type="email" />
          <Field label="Senha provisória (mínimo 8 caracteres)" name="password" type="password" />
          <label className="flex flex-col gap-1 text-sm font-medium">
            Papel
            <select name="role" defaultValue="manager" className="h-11 card px-3 text-base">
              <option value="manager">Gestor (só visualiza os clientes que você liberar)</option>
              <option value="admin">Admin (vê e edita tudo)</option>
            </select>
          </label>
        </AdminForm>
      </Reveal>
    </>
  );
}
