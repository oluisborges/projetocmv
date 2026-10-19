import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { requireMember } from "@/lib/auth";
import { loadFixedCosts, loadStaff } from "@/lib/costs-data";
import { formatBRL, formatPct } from "@/lib/format";
import { hasMenuConnection } from "@/lib/menu-data";
import { activeUnit, loadPricingContext } from "@/lib/pricing-data";
import { signOut } from "../actions";

export const metadata = { title: "Ajustes" };

type Item = { href: string; title: string; description: string; status?: string };

export default async function SettingsPage() {
  const { orgId, canWrite } = await requireMember();
  const [ctx, connected, unit] = await Promise.all([loadPricingContext(orgId, canWrite), hasMenuConnection(orgId), activeUnit(orgId)]);
  const [fixedCosts, staff] = unit ? await Promise.all([loadFixedCosts(unit.id), loadStaff(unit.id)]) : [[], []];

  const items: Item[] = [
    {
      href: "/ajustes/custos",
      title: "Custos fixos e equipe",
      description: "Aluguel, energia, salários.",
      status: fixedCosts.length + staff.length > 0 ? `${fixedCosts.length} ${fixedCosts.length === 1 ? "conta" : "contas"} · ${staff.length} ${staff.length === 1 ? "pessoa" : "pessoas"}${ctx ? ` · ${formatBRL(ctx.fixedTotal)}/mês` : ""}` : "Nada cadastrado ainda",
    },
    {
      href: "/ajustes/impostos",
      title: "Impostos, taxas e meta de lucro",
      description: "Entram na conta do lucro de todas as marmitas.",
      status: ctx ? (ctx.configured ? `Impostos: ${formatPct(ctx.settings.taxPct)} · Meta de lucro: ${formatPct(ctx.settings.profitPct)}` : "Ainda não preenchido") : undefined,
    },
    ...(connected
      ? [{ href: "/ajustes/cardapio", title: "Cardápio digital", description: "Ligar o que o cardápio vende às suas fichas.", status: "Conectado" }]
      : []),
    { href: "/conta/senha", title: "Minha conta", description: "Trocar a senha de acesso." },
    { href: "/privacidade", title: "Privacidade", description: "Como seus dados são tratados." },
  ];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Ajustes</h1>
        <p className="text-muted">O que você configura uma vez e raramente muda.</p>
      </section>

      <ul className="flex flex-col gap-3">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="card flex min-h-14 items-center justify-between gap-3 p-4">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{it.title}</span>
                <span className="text-sm text-muted">{it.description}</span>
                {it.status ? <span className="text-xs font-semibold text-primary">{it.status}</span> : null}
              </span>
              <span aria-hidden className="text-muted">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <form action={signOut}>
        <SubmitButton pendingLabel="Saindo…" className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-surface px-4 font-semibold text-danger">
          Sair da conta
        </SubmitButton>
      </form>
    </>
  );
}
