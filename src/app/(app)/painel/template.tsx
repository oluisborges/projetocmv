/**
 * Um template recomeça a cada navegação dentro desta seção (ex.: Custos fixos ↔ Resultado do mês).
 * Sem ele, a troca entre as duas abas não mostra o esqueleto de carregamento.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
