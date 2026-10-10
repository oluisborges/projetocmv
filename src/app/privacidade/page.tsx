import Link from "next/link";

export const metadata = { title: "Como seus dados são tratados" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-10">
      <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
        ← Voltar
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Como seus dados são tratados</h1>
        <p className="text-muted">Texto simples sobre o que o app guarda e quem vê. Este texto-base deve ser revisado pelo jurídico do Grupo Shogun antes do uso com clientes.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">O que guardamos</h2>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>Seu e-mail, seu nome e a senha (guardada de forma criptografada; nem a equipe consegue ler).</li>
          <li>Os dados do seu negócio que você digita: insumos e preços, fichas técnicas, custos fixos, equipe, faturamento, compras e vendas do mês.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Quem vê</h2>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>Você e as pessoas que a sua marmitaria autorizou, dentro do papel de cada uma (dono, gerente ou só leitura).</li>
          <li>A equipe do Grupo Shogun, para dar suporte e acompanhar a sua conta.</li>
          <li>Os dados de uma marmitaria nunca aparecem para outra marmitaria.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Para que usamos</h2>
        <p className="leading-relaxed">Só para calcular custo, preço e lucro da sua marmitaria e mostrar isso para você. Não vendemos os seus dados.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Seus direitos</h2>
        <p className="leading-relaxed">Você pode pedir uma cópia dos seus dados, a correção deles ou a exclusão da sua conta. Fale com a equipe do Grupo Shogun pelo grupo de WhatsApp.</p>
      </section>
    </main>
  );
}
