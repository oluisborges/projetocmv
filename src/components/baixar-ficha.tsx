"use client";

import { useEffect, useState } from "react";
import { CAMPOS_PADRAO, camposFromParam, camposToParam, type FichaCampos } from "@/lib/ficha-campos";
import { PersonalizarModal } from "@/components/personalizar-ficha-modal";

const STORAGE_KEY = "precificai:ficha-campos";

/** Os campos escolhidos pela pessoa, lembrados neste aparelho (só conveniência: se o navegador bloquear, vale o padrão). */
function useFichaCampos(): [FichaCampos, (c: FichaCampos) => void] {
  const [campos, setCampos] = useState<FichaCampos>({ ...CAMPOS_PADRAO });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ler o localStorage só é possível no navegador, depois da hidratação
      if (saved !== null) setCampos(camposFromParam(saved));
    } catch {}
  }, []);
  const save = (next: FichaCampos) => {
    setCampos(next);
    try {
      localStorage.setItem(STORAGE_KEY, camposToParam(next));
    } catch {}
  };
  return [campos, save];
}

/** Botão "Baixar ficha": abre a janela para escolher o modelo e os campos e baixar em PDF ou Excel. */
export function BaixarFichaButton({ id, name, kind }: { id: string; name: string; kind: "marmita" | "receita" }) {
  const [campos, save] = useFichaCampos();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-3 py-1 text-center text-sm font-semibold leading-tight text-primary-foreground">
        Baixar ficha
      </button>
      {open ? <PersonalizarModal campos={campos} itemId={id} itemName={name} kind={kind} onSave={save} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
