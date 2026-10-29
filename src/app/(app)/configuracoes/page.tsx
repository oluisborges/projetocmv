import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { BrandFooter } from "@/components/brand-footer";
import { SubmitButton } from "@/components/submit-button";
import { getActiveOrg, requireUser } from "@/lib/auth";
import { signOut } from "../actions";
import { CompanyForm, NameForm, PasswordForm } from "./settings-forms";

export const metadata = { title: "Configurações" };

const ROLE: Record<string, string> = { owner: "dono", manager: "gerente", viewer: "só leitura" };

export default async function SettingsPage() {
  const session = await requireUser();
  const active = await getActiveOrg();
  const membership = session.memberships[0];
  const isOwner = membership?.role === "owner";

  if (active?.viewingAs) {
    return (
      <>
        <BackLink href="/">Início</BackLink>
        <h1 className="text-2xl font-extrabold tracking-tight">Configurações</h1>
        <p className="card p-4 text-sm text-muted">As configurações ficam desligadas no &quot;Ver como&quot;, porque são do cliente. Saia do &quot;Ver como&quot; para mexer nas suas.</p>
      </>
    );
  }

  const section = "flex flex-col gap-3 card p-4";
  const heading = "text-sm font-semibold uppercase tracking-wider text-muted";
  return (
    <>
      <BackLink href="/">Início</BackLink>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-muted">
          {session.email}
          {membership ? ` · ${ROLE[membership.role] ?? membership.role}` : session.isPlatformAdmin ? " · equipe Shogun" : ""}
        </p>
      </section>

      <section className={section}>
        <h2 className={heading}>Você</h2>
        <NameForm defaultName={session.fullName ?? ""} />
      </section>

      {membership ? (
        <section className={section}>
          <h2 className={heading}>Empresa</h2>
          {isOwner ? (
            <CompanyForm defaultName={membership.org.name} />
          ) : (
            <p className="text-sm">
              <strong>{membership.org.name}</strong>
              <span className="block text-muted">Só o dono da marmitaria pode mudar o nome da empresa.</span>
            </p>
          )}
        </section>
      ) : null}

      <section className={section}>
        <h2 className={heading}>Senha</h2>
        <PasswordForm />
      </section>

      <section className={section}>
        <h2 className={heading}>Outros</h2>
        {session.isPlatformAdmin ? (
          <Link href="/admin" className="tap-area font-semibold text-primary underline">
            Painel Shogun
          </Link>
        ) : null}
        <Link href="/privacidade" className="tap-area font-semibold text-primary underline">
          Como seus dados são tratados
        </Link>
        <form action={signOut}>
          <SubmitButton pendingLabel="Saindo…" className="h-12 w-full rounded-xl border border-border bg-surface font-semibold text-danger">
            Sair da conta
          </SubmitButton>
        </form>
      </section>

      <BrandFooter />
    </>
  );
}
