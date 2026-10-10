import { PageSkeleton } from "@/components/page-skeleton";

/** Troca de aba (ex.: Custos fixos ↔ Resultado do mês): mostra o esqueleto com o lugar das abas. */
export default function Loading() {
  return <PageSkeleton tabs />;
}
