/**
 * Um template recomeça a cada navegação dentro desta seção (Fechar o mês ↔ Estoque ↔ Histórico).
 * Sem ele, a troca entre as páginas não mostra o esqueleto de carregamento.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
