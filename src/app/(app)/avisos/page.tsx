import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { loadNotices } from "@/lib/notices-data";

export const metadata = { title: "Avisos" };

const TONE = {
  bad: "border-danger/40 bg-danger/10",
  warn: "border-warning/40 bg-warning/10",
  info: "border-border bg-surface",
} as const;

const BADGE = {
  bad: { label: "Urgente", cls: "bg-danger text-white" },
  warn: { label: "Atenção", cls: "bg-warning text-white" },
  info: { label: "Informação", cls: "bg-border text-foreground" },
} as const;

export default async function NoticesPage() {
  const { orgId, canWrite } = await requireMember();
  const notices = await loadNotices(orgId, canWrite);

  return (
    <>
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Avisos</h1>
        <p className="text-muted">O que merece a sua atenção agora.</p>
      </section>

      {notices.length === 0 ? (
        <p role="status" className="flex min-h-14 items-center gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 font-semibold text-success">
          Tudo em dia ✓
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notices.map((n) => (
            <li key={n.key}>
              <Link href={n.href} className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border p-4 ${TONE[n.tone]}`}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[n.tone].cls}`}>{BADGE[n.tone].label}</span>
                  <span className="font-bold leading-snug">{n.title}</span>
                  <span className="text-sm text-muted">{n.detail}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-primary">{n.cta} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
