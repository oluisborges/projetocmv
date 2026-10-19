"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { ConfirmButton } from "@/components/confirm-button";
import { addChannel, deleteChannel, saveSettings, updateChannel } from "./actions";

const pct = (fraction: number) => String(Number((fraction * 100).toFixed(2))).replace(".", ",");

/** Percentual aproximado de imposto sobre a venda por regime. É um ponto de partida: o contador confirma o número certo. */
const REGIMES = [
  { value: "mei", label: "MEI", tax: 0, note: "O MEI paga um valor fixo por mês (guia DAS), não um percentual sobre cada venda. Por isso começa em 0%." },
  { value: "simples", label: "Simples Nacional", tax: 6, note: "Para alimentação costuma ficar entre 4% e 10%, conforme o faturamento. Começamos em 6%." },
  { value: "presumido", label: "Lucro Presumido", tax: 11, note: "Em geral entre 9% e 13% sobre a venda. Começamos em 11%." },
  { value: "none", label: "Não pago imposto", tax: 0, note: "Sem imposto na conta." },
  { value: "unknown", label: "Não sei", tax: 6, note: "Começamos em 6%, uma média segura. Pergunte ao seu contador e ajuste depois." },
] as const;

function guessRegime(taxPct: number): string {
  const v = Number((taxPct * 100).toFixed(2));
  return REGIMES.find((r) => r.tax === v && r.value !== "unknown")?.value ?? "custom";
}

export function SettingsForm({
  settings,
  fixedAuto,
  configured,
}: {
  settings: { taxPct: number; fixedExpensePct: number; profitPct: number; minMarginPct: number; otherPct?: number; safetyMarginPct?: number };
  fixedAuto: boolean;
  configured: boolean;
}) {
  const [regime, setRegime] = useState(configured ? guessRegime(settings.taxPct) : "");
  const chosen = REGIMES.find((r) => r.value === regime);
  const taxDefault = chosen ? String(chosen.tax).replace(".", ",") : pct(settings.taxPct);

  return (
    <ActionForm action={saveSettings} submitLabel="Salvar ajustes">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Como você paga imposto?
        <select value={regime} onChange={(e) => setRegime(e.target.value)} className="h-12 rounded-xl border border-border bg-surface px-3 text-base">
          <option value="" disabled>
            Escolha uma opção
          </option>
          {REGIMES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          {regime === "custom" ? <option value="custom">Outro (valor abaixo)</option> : null}
        </select>
      </label>
      {chosen ? <p className="-mt-2 text-xs text-muted">{chosen.note}</p> : null}
      <TextField
        key={regime}
        label="Imposto sobre cada venda (%)"
        name="tax"
        inputMode="decimal"
        defaultValue={taxDefault}
        required={false}
        hint={<Hint>Quanto de cada R$ 100 vendidos vai embora em imposto. É uma estimativa para o preço: seu contador sabe o número exato.</Hint>}
      />
      <TextField
        label="Lucro mínimo que você aceita (%)"
        name="min_margin"
        inputMode="decimal"
        defaultValue={pct(settings.minMarginPct)}
        required={false}
        hint={<Hint>De cada R$ 100 vendidos, quanto no mínimo você quer que sobre limpo no bolso. Abaixo disso o app avisa em vermelho que o produto está dando pouco lucro.</Hint>}
      />
      {fixedAuto ? (
        <div className="flex flex-col gap-1 card p-4 text-sm">
          <p className="font-medium">Despesas fixas: {pct(settings.fixedExpensePct)}% do que você vende</p>
          <p className="text-muted">Calculado sozinho a partir das suas contas e da sua equipe.</p>
          <Link href="/custos" className="inline-flex min-h-11 items-center font-semibold text-primary">
            Ver ou alterar em Custos fixos e equipe →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-1 card p-4 text-sm">
          <p className="font-medium">Despesas fixas (aluguel, luz, equipe…)</p>
          <p className="text-muted">Conte quanto paga por mês e quanto vende em Custos, na aba Custos fixos: o app calcula esse percentual para você.</p>
          <Link href="/custos" className="inline-flex min-h-11 items-center font-semibold text-primary">
            Informar em Custos fixos e equipe →
          </Link>
        </div>
      )}
      <details className="card">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold text-primary">Avançado</summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <TextField
            label="Outras taxas sobre cada venda (%) · opcional"
            name="other"
            inputMode="decimal"
            defaultValue={pct(settings.otherPct ?? 0)}
            required={false}
            hint={<Hint>Comissão de vendedor, taxa de plataforma ou qualquer outra porcentagem que sai de cada venda e não é imposto nem taxa de canal. Sem nenhuma, deixe 0.</Hint>}
          />
          <TextField
            label="Margem de segurança nos insumos (%)"
            name="safety"
            inputMode="decimal"
            defaultValue={pct(settings.safetyMarginPct ?? 0)}
            required={false}
            hint={<Hint>Soma esse percentual ao custo dos ingredientes de cada ficha para cobrir perdas e desperdício. Para retirar, deixe 0.</Hint>}
          />
          {!fixedAuto ? (
            <TextField
              label="Despesas fixas à mão (% do que vende)"
              name="fixed"
              inputMode="decimal"
              defaultValue={pct(settings.fixedExpensePct)}
              required={false}
              hint={<Hint>Só se não quiser informar as contas em Custos, na aba Custos fixos. Digite uma estimativa do quanto de cada venda vai para despesas fixas.</Hint>}
            />
          ) : null}
        </div>
      </details>
    </ActionForm>
  );
}

export function ChannelRow({ channel }: { channel: { id: string; name: string; fee_pct: number } }) {
  return (
    <li className="flex flex-col gap-3 py-4">
      <ActionForm action={updateChannel} submitLabel="Salvar canal">
        <input type="hidden" name="id" value={channel.id} />
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <TextField label="Nome" name="name" defaultValue={channel.name} />
          <TextField label="Taxa (%)" name="fee" inputMode="decimal" defaultValue={pct(channel.fee_pct)} required={false} />
        </div>
      </ActionForm>
      <form action={deleteChannel}>
        <input type="hidden" name="id" value={channel.id} />
        <ConfirmButton message={`Remover o canal ${channel.name}?`} className="h-11 text-sm font-semibold text-danger">
          Remover canal
        </ConfirmButton>
      </form>
    </li>
  );
}

export function AddChannelForm() {
  return (
    <ActionForm action={addChannel} submitLabel="Adicionar canal" resetOnOk>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <TextField label="Nome do canal" name="name" placeholder="Ex.: iFood" />
        <TextField label="Taxa (%)" name="fee" inputMode="decimal" required={false} placeholder="Ex.: 27" />
      </div>
    </ActionForm>
  );
}
