import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Esqueci minha senha" };

// Link do grupo de WhatsApp do Grupo Shogun (opcional). Defina NEXT_PUBLIC_SHOGUN_WHATSAPP_URL na Vercel para mostrar o botão.
const WHATSAPP_URL = process.env.NEXT_PUBLIC_SHOGUN_WHATSAPP_URL;

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Voltar para o login
      </Link>

      <header className="flex flex-col items-center gap-4 text-center">
        <Image src="/brand/helmet.png" alt="" width={149} height={160} priority className="h-16 w-auto" />
        <h1 className="text-2xl font-extrabold tracking-tight">Esqueceu a senha?</h1>
      </header>

      <section className="flex flex-col gap-4 card p-5">
        <p className="leading-relaxed">
          Por segurança, a senha é trocada pela equipe da Shogun. <strong>Mande uma mensagem no grupo de WhatsApp do Grupo Shogun</strong> pedindo uma nova senha.
        </p>
        <p className="text-sm text-muted">
          Informe no pedido o e-mail que você usa para entrar. A equipe confirma que é você e passa uma <strong>senha provisória</strong>. No primeiro acesso, o app
          pede para você criar a sua própria senha.
        </p>
        <p className="text-sm text-muted">Se no grupo houver pessoas de fora da sua marmitaria, peça que a senha provisória venha em mensagem privada.</p>

        {WHATSAPP_URL ? (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground"
          >
            Abrir o grupo no WhatsApp
          </a>
        ) : null}
      </section>
    </main>
  );
}
