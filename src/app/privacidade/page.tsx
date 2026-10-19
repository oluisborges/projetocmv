import { HistoryBack } from "@/components/history-back";

export const metadata = { title: "Como seus dados são tratados" };

// Texto-base em linguagem simples. Antes de abrir o app para todos os clientes, o Grupo Shogun deve revisar com o jurídico e
// acrescentar a razão social, o CNPJ e o contato oficial do encarregado de dados (LGPD).
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-10">
      <HistoryBack fallback="/" />

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Como seus dados são tratados</h1>
        <p className="text-muted">Em palavras simples: o que o app guarda, quem vê, onde fica e como pedir a exclusão.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">O que guardamos</h2>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>Seu e-mail, seu nome e a senha (guardada de forma criptografada; nem a equipe consegue ler).</li>
          <li>Os dados do seu negócio que você digita: insumos e preços, fichas técnicas, custos fixos, equipe, faturamento, compras e vendas do mês.</li>
          <li>Um histórico de uso: quando você entra, quais telas abre e o que altera (por exemplo, o preço de um insumo), com data e hora. Serve para a equipe do Precificaí (Grupo Shogun) dar suporte e acompanhar se o sistema está ajudando; quem usa a sua conta não vê esse histórico, só a equipe do Grupo Shogun.</li>
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
        <h2 className="text-lg font-bold">Onde ficam os dados</h2>
        <p className="leading-relaxed">
          No banco de dados do Supabase, em servidores em São Paulo (Brasil). O site é hospedado na Vercel. Os dois são empresas de infraestrutura que guardam os dados em nosso nome.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Por quanto tempo</h2>
        <p className="leading-relaxed">Enquanto a sua conta estiver ativa. Se você pedir a exclusão, apagamos a conta e os dados da sua marmitaria.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Cookies e registros de segurança</h2>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>Usamos só o cookie necessário para manter você logado. Não usamos cookies de propaganda.</li>
          <li>Para proteger a sua conta, guardamos por até 1 dia as tentativas de login erradas, de forma codificada (sem mostrar e-mail ou endereço de internet), para bloquear quem tenta adivinhar senhas.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Seus direitos</h2>
        <p className="leading-relaxed">
          Você pode pedir uma cópia dos seus dados, a correção deles ou a exclusão da sua conta. Fale com a equipe do Grupo Shogun pelo grupo de WhatsApp.
        </p>
      </section>
    </main>
  );
}
