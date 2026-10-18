import { Hint } from "@/components/hint";

const link = "inline-flex h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold";

/** Baixar em PDF ou Excel. Links comuns: o servidor responde com o arquivo. */
export function ExportLinks({ base, params = "", label, hint }: { base: string; params?: string; label: string; hint?: string }) {
  const href = (format: "pdf" | "xlsx") => `${base}?${params ? `${params}&` : ""}formato=${format}`;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={label}>
      <span className="text-sm font-semibold">
        {label}
        {hint ? <Hint>{hint}</Hint> : null}
      </span>
      <a href={href("pdf")} download className={link}>
        PDF
      </a>
      <a href={href("xlsx")} download className={link}>
        Excel
      </a>
    </div>
  );
}
