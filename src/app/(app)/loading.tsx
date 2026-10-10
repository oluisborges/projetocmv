import { PageSkeleton } from "@/components/page-skeleton";

/** Aparece na hora ao trocar de menu, enquanto a página nova carrega no servidor. */
export default function Loading() {
  return <PageSkeleton />;
}
