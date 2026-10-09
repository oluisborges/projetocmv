import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const session = await requireUser();
  const supabase = await createClient();
  const { data: units } = await supabase.from("units").select("id, name, city, org_id").order("name");

  const firstName = session.fullName?.split(" ")[0];

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Olá{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="text-muted">Em breve aqui: o custo e a margem de cada marmita.</p>
      </section>

      {session.memberships.length === 0 && !session.isPlatformAdmin ? (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          Sua conta ainda não está ligada a nenhuma marmitaria. Fale com a Shogun.
        </p>
      ) : null}

      {units && units.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Suas unidades</h2>
          <ul className="flex flex-col gap-2">
            {units.map((u) => (
              <li key={u.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="font-semibold">{u.name}</p>
                {u.city ? <p className="text-sm text-muted">{u.city}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {session.isPlatformAdmin ? (
        <Link href="/admin" className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-primary-foreground">
          Abrir painel Shogun
        </Link>
      ) : null}
    </>
  );
}
