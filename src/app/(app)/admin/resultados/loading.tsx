import { PageSkeleton } from "@/components/page-skeleton";

/** Aparece na hora enquanto os números da rede carregam. */
export default function Loading() {
  return <PageSkeleton tabs />;
}
