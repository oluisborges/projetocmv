import { PageSkeleton } from "@/components/page-skeleton";

/** Aparece na hora enquanto a ficha da marmita carrega (com o lugar das abas Ficha | Preço de venda). */
export default function Loading() {
  return <PageSkeleton back tabs />;
}
