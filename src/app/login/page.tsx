import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col items-center gap-6 text-center">
        <Image src="/brand/logo-stacked.png" alt="Grupo Shogun" width={560} height={358} priority className="h-auto w-44" />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Quanto você ganha em cada marmita?</h1>
          <p className="text-muted">Entre com o e-mail e a senha que a Shogun passou para você.</p>
        </div>
      </header>
      <LoginForm />
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
