import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const blocked = (await searchParams).motivo === "bloqueado";
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-7 px-4 py-10">
      <header className="flex flex-col items-center gap-6 text-center">
        <Image src="/brand/logo-horizontal.svg" alt="Precificaí" width={635} height={128} priority className="h-auto w-56" />
        <div className="flex flex-col gap-2">
          <span aria-hidden className="mx-auto h-1 w-12 rounded-full bg-accent" />
          <h1 className="text-3xl font-extrabold tracking-tight">Quanto você ganha em cada produto?</h1>
          <p className="text-muted">Entre com o e-mail e a senha que o Grupo Shogun passou para você.</p>
        </div>
      </header>
      {blocked ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-center text-sm font-medium text-danger">
          O seu acesso está bloqueado. Fale com o Grupo Shogun.
        </p>
      ) : null}
      <div className="card p-5">
        <LoginForm />
      </div>
      <div className="flex flex-col items-center gap-1 text-sm">
        <Link href="/esqueci-senha" className="inline-flex min-h-11 items-center font-semibold text-primary">
          Esqueci minha senha
        </Link>
        <Link href="/privacidade" className="inline-flex min-h-11 items-center text-muted underline">
          Como seus dados são tratados
        </Link>
      </div>
    </main>
  );
}
