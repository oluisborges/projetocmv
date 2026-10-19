import Image from "next/image";
import { HistoryBack } from "@/components/history-back";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./password-form";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Criar minha senha" };

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const forced = session.mustChangePassword;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      {forced ? null : (
        <HistoryBack fallback="/" />
      )}

      <header className="flex flex-col items-center gap-4 text-center">
        <Image src="/brand/simbolo.svg" alt="Precificaí" width={120} height={128} priority className="h-16 w-auto" />
        <h1 className="text-2xl font-extrabold tracking-tight">{forced ? "Crie a sua senha" : "Trocar minha senha"}</h1>
        <p className="text-muted">
          {forced
            ? "A senha que o Grupo Shogun passou é provisória. Crie uma senha só sua para continuar: só você vai saber."
            : "Escolha uma senha nova. Ela vale a partir de agora."}
        </p>
      </header>

      <PasswordForm />

      {forced ? (
        <form action={signOut} className="text-center">
          <SubmitButton pendingLabel="Saindo…" className="h-11 text-sm font-semibold text-muted underline">
            Sair
          </SubmitButton>
        </form>
      ) : null}
    </main>
  );
}
