"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import type { Announcement, AnnouncementSection } from "@/lib/announcements";
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

/** Texto com **destaques** em negrito. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) => (
        <Fragment key={i}>{i % 2 === 1 ? <strong className="font-bold text-foreground">{part}</strong> : part}</Fragment>
      ))}
    </>
  );
}

/** "Início: o Resumo mostra…" vira uma linha com o nome do menu em destaque. */
function BulletRow({ text }: { text: string }) {
  const cut = text.indexOf(": ");
  const lead = cut > 0 && cut <= 28 ? text.slice(0, cut) : null;
  return (
    <li className="flex gap-3 rounded-xl bg-background px-3 py-2.5 text-sm leading-snug">
      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      <span className="min-w-0 text-foreground/80">
        {lead ? <strong className="font-bold text-foreground">{lead}: </strong> : null}
        <Rich text={lead ? text.slice(cut + 2) : text} />
      </span>
    </li>
  );
}

function SectionBlock({ s }: { s: AnnouncementSection }) {
  return (
    <section className={`flex gap-3.5 ${s.highlight ? "rounded-2xl border-2 border-accent/70 bg-tint/50 p-3.5" : ""}`}>
      <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl ${s.highlight ? "bg-surface shadow-sm" : "bg-tint"}`}>
        {s.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-extrabold leading-snug">
          {s.title}
          {s.badge ? <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-foreground">{s.badge}</span> : null}
        </h3>
        <p className="text-sm leading-relaxed text-foreground/80">
          <Rich text={s.body} />
        </p>
        {s.bullets ? (
          <ul className="flex flex-col gap-1.5">
            {s.bullets.map((b) => (
              <BulletRow key={b} text={b} />
            ))}
          </ul>
        ) : null}
        {s.after ? (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground/80">
            <span aria-hidden>🔒</span>
            <span>
              <Rich text={s.after} />
            </span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Modal de novidades. O X fecha e o aviso volta no próximo acesso (não a cada troca de menu).
 * A caixinha "entendi, não mostrar mais" grava na conta da pessoa e o aviso não volta nunca mais.
 * `preview`: rascunho do admin; só abre com ?aviso=ver na barra de endereço e nunca grava nada.
 * No celular sobe de baixo como uma folha; no computador abre no centro.
 */
export function AnnouncementModal({ announcement, preview }: { announcement: Announcement; preview: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const [moreBelow, setMoreBelow] = useState(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    const wanted = preview ? new URLSearchParams(window.location.search).get("aviso") === "ver" : !closedThisVisit(announcement.id);
    if (wanted) dialog.showModal();
  }, [announcement.id, preview]);

  const checkScroll = () => {
    const el = bodyRef.current;
    if (el) setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 12);
  };

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
      onClick={(e) => e.target === ref.current && close()}
      className="announcement m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/55 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-deep to-primary px-5 pb-5 pt-5 text-primary-foreground">
          <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-accent" />
          <button
            type="button"
            onClick={close}
            aria-label="Fechar aviso"
            className="absolute right-3 top-3.5 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white active:bg-white/25"
          >
            ×
          </button>
          <p className="mb-2 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-accent-foreground">Novidades</p>
          <h2 id="announcement-title" className="pr-12 text-2xl font-extrabold leading-tight tracking-tight">
            {announcement.title}
          </h2>
          <p className="mt-1.5 pr-4 text-sm leading-snug text-white/85">{announcement.intro}</p>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div ref={bodyRef} onScroll={checkScroll} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
            {announcement.sections.map((s) => (
              <SectionBlock key={s.title} s={s} />
            ))}
          </div>
          {moreBelow ? (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-surface via-surface/90 to-transparent pb-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">↓ role para ver mais</span>
            </div>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border bg-surface px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border bg-tint/40 px-3 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-tint">
            <input type="checkbox" onChange={(e) => dismissForever(e.target.checked)} className="size-6 shrink-0 accent-[var(--color-primary)]" />
            Entendi, não precisa mais mostrar este aviso
          </label>
        </footer>
      </div>
    </dialog>
  );
}
