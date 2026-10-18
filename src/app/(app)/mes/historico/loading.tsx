import { PageSkeleton } from "@/components/page-skeleton";

/** Troca de aba (Fechar ↔ Estoque ↔ Histórico): mostra o esqueleto com o lugar das abas. */
export default function Loading() {
  return <PageSkeleton tabs />;
}
