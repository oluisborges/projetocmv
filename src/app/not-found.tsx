import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Página não encontrada" };

/** Página que não existe: em português, com a marca e um caminho de volta. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-5 px-6 text-center">
      <Image src="/brand/logo-horizontal.svg" alt="Precificaí" width={635} height={128} priority className="h-8 w-auto" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Página não encontrada</h1>
        <p className="text-muted">O endereço pode ter mudado ou ter um erro de digitação.</p>
      </div>
      <Link href="/" className="flex h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground">
        Voltar ao início
      </Link>
    </main>
  );
}
