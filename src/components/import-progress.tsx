"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { resumeMenuImport } from "@/app/(app)/ajustes/cardapio/actions";
import { Spinner } from "@/components/spinner";

const EVERY_MS = 20_000;

/**
 * Aviso "ainda importando" que se atualiza sozinho. Enquanto o cardápio importa, confere a cada 20 s: mostra quantos pedidos faltam,
 * retoma a importação se ela parou e recarrega os números da tela. Quando termina, some. Só aparece se há importação em andamento.
 */
export function ImportProgress({ initialImporting, initialPending }: { initialImporting: boolean; initialPending: number }) {
  const router = useRouter();
  // Resposta do último batimento, válida só enquanto a tela não trouxe dados novos do servidor (router.refresh troca as props).
  const base = `${initialImporting}:${initialPending}`;
  const [polled, setPolled] = useState<{ base: string; importing: boolean; pending: number } | null>(null);
  const shown = polled && polled.base === base ? polled : { importing: initialImporting, pending: initialPending };
  const busy = useRef(false);

  useEffect(() => {
    if (!shown.importing) return;
    const id = setInterval(async () => {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      try {
        const next = await resumeMenuImport();
        setPolled({ base, ...next });
        router.refresh(); // números e listas da tela acompanham o que chegou
      } catch {
        // sem rede agora: tenta de novo no próximo intervalo
      } finally {
        busy.current = false;
      }
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [shown.importing, base, router]);

  if (!shown.importing) return null;
  return (
    <p role="status" className="flex items-start gap-2 rounded-xl bg-warning/10 p-3 text-sm">
      <Spinner className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong>Ainda importando seus pedidos</strong>
        {shown.pending > 0 ? ` (faltam ${shown.pending})` : ""}. Os números do mês se completam sozinhos, não precisa recarregar.
      </span>
    </p>
  );
}
