import { PageSkeleton } from "@/components/page-skeleton";

/** Aparece na hora enquanto a análise do cardápio carrega. */
export default function Loading() {
  return <PageSkeleton tabs />;
}
