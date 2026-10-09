import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">Grupo Shogun</span>
        <h1 className="text-3xl font-extrabold tracking-tight">Quanto você ganha em cada marmita?</h1>
        <p className="text-muted">Entre com o e-mail e a senha que a Shogun passou para você.</p>
      </header>
      <LoginForm />
      <p className="text-center text-sm text-muted">Esqueceu a senha? Fale com a Shogun para receber uma nova.</p>
    </main>
  );
}
