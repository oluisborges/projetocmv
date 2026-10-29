"use client";

import { useEffect, useRef, useTransition } from "react";
import type { Announcement } from "@/lib/announcements";
import { dismissAnnouncement } from "./actions";

const seenKey = (id: string) => `aviso-fechado:${id}`;

/** Marca, só neste navegador e só até fechar a aba, que a pessoa já viu o aviso: ele não volta a cada menu, mas volta no próximo acesso. */
function rememberClosedThisVisit(id: string) {
  try {
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    /* sem armazenamento: o aviso só pode reaparecer ao trocar de página */
  }
}

function closedThisVisit(id: string): boolean {
  try {
    return sessionStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}

/**
 * Modal de novidades. O X fecha e o aviso volta no próximo acesso (não a cada troca de menu).
 * A caixinha "entendi, não mostrar mais" grava na conta da pessoa e o aviso não volta nunca mais.
 * `preview`: rascunho do admin; só abre com ?aviso=ver na barra de endereço e nunca grava nada.
 */
export function AnnouncementModal({ announcement, preview }: { announcement: Announcement; preview: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    const wanted = preview ? new URLSearchParams(window.location.search).get("aviso") === "ver" : !closedThisVisit(announcement.id);
    if (wanted) dialog.showModal();
  }, [announcement.id, preview]);

  const close = () => {
    if (!preview) rememberClosedThisVisit(announcement.id);
    ref.current?.close();
  };

  const dismissForever = (checked: boolean) => {
    if (!checked) return;
    rememberClosedThisVisit(announcement.id);
    ref.current?.close();
    if (!preview) startTransition(() => void dismissAnnouncement(announcement.id));
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="announcement-title"
      onClose={() => !preview && rememberClosedThisVisit(announcement.id)}
      className="m-auto max-h-[88dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="announcement-title" className="text-xl font-extrabold leading-tight tracking-tight">
              🎉 {announcement.title}
            </h2>
            <p className="text-sm text-muted">{announcement.intro}</p>
          </div>
          <button type="button" onClick={close} aria-label="Fechar aviso" className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl leading-none text-muted active:bg-background">
            ×
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {announcement.sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-1.5">
              <h3 className="font-bold leading-snug">
                <span aria-hidden>{s.icon} </span>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed">{s.body}</p>
              {s.bullets ? (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {s.after ? <p className="text-sm leading-relaxed text-muted">{s.after}</p> : null}
            </section>
          ))}
        </div>

        <footer className="border-t border-border px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" onChange={(e) => dismissForever(e.target.checked)} className="size-5 shrink-0 accent-[var(--color-primary)]" />
            Entendi, não precisa mais mostrar este aviso
          </label>
        </footer>
      </div>
    </dialog>
  );
}
