import { PageSkeleton } from "@/components/page-skeleton";

/** Aparece na hora enquanto a análise dos cupons carrega. */
export default function Loading() {
  return <PageSkeleton tabs />;
}
