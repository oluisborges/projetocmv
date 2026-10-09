"use client";

import { ActionForm, TextField } from "@/components/forms";
import { Hint } from "@/components/hint";
import { ConfirmButton } from "@/components/confirm-button";
import { addChannel, deleteChannel, saveSettings, updateChannel } from "../actions";

const pct = (fraction: number) => String(Number((fraction * 100).toFixed(2))).replace(".", ",");

export function SettingsForm({ settings }: { settings: { taxPct: number; fixedExpensePct: number; profitPct: number; minMarginPct: number } }) {
  return (
    <ActionForm action={saveSettings} submitLabel="Salvar ajustes">
      <TextField
        label="Impostos sobre a venda (%)"
        name="tax"
        inputMode="decimal"
        defaultValue={pct(settings.taxPct)}
        required={false}
        hint={<Hint>O percentual que vai embora em imposto de cada venda (Simples Nacional, por exemplo). Se não souber, pergunte ao seu contador. Se não paga, deixe 0.</Hint>}
      />
      <TextField
        label="Despesas fixas (% do faturamento)"
        name="fixed"
        inputMode="decimal"
        defaultValue={pct(settings.fixedExpensePct)}
        required={false}
        hint={<Hint>Aluguel, energia dos freezers, sistemas, pró-labore… dividido pelo que você fatura no mês. Em breve o app calcula isso sozinho; por enquanto, informe uma estimativa.</Hint>}
      />
      <TextField
        label="Lucro que você quer (%)"
        name="profit"
        inputMode="decimal"
        defaultValue={pct(settings.profitPct)}
        required={false}
        hint={<Hint>De cada R$ 100 vendidos, quanto você quer que sobre limpo no bolso depois de pagar tudo. É isso que o preço sugerido protege.</Hint>}
      />
      <TextField
        label="Margem mínima aceitável (%)"
        name="min_margin"
        inputMode="decimal"
        defaultValue={pct(settings.minMarginPct)}
        required={false}
        hint={<Hint>Abaixo disso o app avisa em vermelho que a marmita está dando pouco lucro. Costuma ser menor que o lucro desejado.</Hint>}
      />
    </ActionForm>
  );
}

export function ChannelRow({ channel }: { channel: { id: string; name: string; fee_pct: number } }) {
  return (
    <li className="flex flex-col gap-3 py-4">
      <ActionForm action={updateChannel} submitLabel="Salvar canal">
        <input type="hidden" name="id" value={channel.id} />
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <TextField label="Nome" name="name" defaultValue={channel.name} />
          <TextField label="Taxa (%)" name="fee" inputMode="decimal" defaultValue={pct(channel.fee_pct)} required={false} />
        </div>
      </ActionForm>
      <form action={deleteChannel}>
        <input type="hidden" name="id" value={channel.id} />
        <ConfirmButton message={`Remover o canal ${channel.name}?`} className="h-9 text-sm font-semibold text-danger">
          Remover canal
        </ConfirmButton>
      </form>
    </li>
  );
}

export function AddChannelForm() {
  return (
    <ActionForm action={addChannel} submitLabel="Adicionar canal">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <TextField label="Nome do canal" name="name" placeholder="Ex.: iFood" />
        <TextField label="Taxa (%)" name="fee" inputMode="decimal" required={false} placeholder="Ex.: 27" />
      </div>
    </ActionForm>
  );
}
