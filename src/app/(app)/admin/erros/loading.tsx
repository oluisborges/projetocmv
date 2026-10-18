import { PageSkeleton } from "@/components/page-skeleton";

/** Aparece na hora enquanto a lista de erros carrega. */
export default function Loading() {
  return <PageSkeleton tabs />;
}
