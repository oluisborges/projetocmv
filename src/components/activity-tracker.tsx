"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/app/(app)/track";

/** Avisa o servidor a cada tela aberta (alimenta o histórico de uso que a Shogun vê). Não mostra nada. */
export function ActivityTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    void trackPageView(pathname);
  }, [pathname]);

  return null;
}
