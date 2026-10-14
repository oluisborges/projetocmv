/** Rodinha de "carregando". Herda a cor do texto; só aparece para quem enxerga (o texto ao lado já diz o que está acontecendo). */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className={`${className} shrink-0 animate-spin`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Conteúdo de um botão enquanto a ação roda: rodinha + texto ("Salvando…"). */
export function PendingLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner />
      {children}
    </span>
  );
}
