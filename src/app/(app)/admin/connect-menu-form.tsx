"use client";

import { useState } from "react";
import { AdminForm, Field } from "./admin-form";
import { connectMenu } from "./menu-actions";

type Provider = "cardapioweb" | "prefiro";

const OPTIONS: { value: Provider; label: string }[] = [
  { value: "cardapioweb", label: "CardápioWeb" },
  { value: "prefiro", label: "Prefiro Delivery" },
];

/**
 * Conectar um cardápio. Os dois pedem a chave de API; o resto muda: o CardápioWeb pede o código da loja e a Prefiro, a hash do
 * estabelecimento. Os campos trocam conforme o cardápio escolhido, com a dica de onde achar cada dado.
 */
export function ConnectMenuForm({ orgId, defaultProvider = "cardapioweb" }: { orgId: string; defaultProvider?: Provider }) {
  const [provider, setProvider] = useState<Provider>(defaultProvider);
  return (
    <AdminForm action={connectMenu} submitLabel="Testar e conectar">
      <input type="hidden" name="orgId" value={orgId} />

      <fieldset className="flex flex-col gap-1">
        <legend className="pb-1 text-sm font-medium">Qual cardápio?</legend>
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
                provider === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"
              }`}
            >
              <input type="radio" name="provider" value={o.value} checked={provider === o.value} onChange={() => setProvider(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Chave de API" name="apiKey" type="password" />
      {provider === "cardapioweb" ? (
        <>
          <Field label="Código da loja" name="storeCode" />
          <p className="text-xs text-muted">No Portal do CardápioWeb: Configurações → Integrações → API. A chave e o código da loja ficam nessa tela.</p>
        </>
      ) : (
        <>
          <Field label="Hash do estabelecimento (ou a URL da API)" name="hash" />
          <p className="text-xs text-muted">No painel da Prefiro Delivery: a hash do estabelecimento e a chave de API.</p>
        </>
      )}
      <p className="text-xs text-muted">A chave é testada antes de salvar e fica guardada só no servidor; ela nunca aparece de volta nesta tela.</p>
    </AdminForm>
  );
}
