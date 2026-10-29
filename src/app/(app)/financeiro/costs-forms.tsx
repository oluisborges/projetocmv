"use client";

import { useState } from "react";
import { ActionForm, SelectField, TextField } from "@/components/forms";
import { ConfirmButton } from "@/components/confirm-button";
import { Hint } from "@/components/hint";
import { formatBRL } from "@/lib/format";
import { Spinner } from "@/components/spinner";
import {
  addFixedCost,
  addStaff,
  deleteFixedCost,
  deleteStaff,
  saveMonthlyNumbers,
  updateFixedCostAmount,
  updateStaffPay,
} from "./actions";

const moneyInput = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctText = (fraction: number) => String(Number((fraction * 100).toFixed(2))).replace(".", ",");

const smallInput =
  "tabular h-11 card px-3 text-right text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export function MonthlyNumbersForm({ revenue, units }: { revenue: number | null; units: number | null }) {
  return (
    <ActionForm action={saveMonthlyNumbers} submitLabel="Salvar números do mês">
      <div className="grid grid-cols-1 gap-3">
        <TextField
          label="Quanto você fatura por mês (R$)"
          name="revenue"
          inputMode="decimal"
          required={false}
          defaultValue={revenue ? moneyInput.format(revenue) : ""}
          placeholder="Ex.: 60.000"
          hint={<Hint>A MÉDIA do que entra por mês com as vendas. Com isso o app calcula quanto dos seus custos fixos pesa em cada real vendido e já usa no preço. O faturamento de cada mês específico você informa em Produção, na aba Fechar o mês.</Hint>}
        />
        <TextField
          label="Quantas unidades você vende por mês"
          name="units"
          inputMode="decimal"
          required={false}
          defaultValue={units ? String(units) : ""}
          placeholder="Ex.: 1400"
          hint={<Hint>A média de unidades vendidas por mês (somando todos os produtos). Serve para mostrar quanto de custo fixo cada unidade precisa pagar.</Hint>}
        />
      </div>
    </ActionForm>
  );
}

export function FixedCostRow({ cost, canWrite }: { cost: { id: string; name: string; monthly_amount: number }; canWrite: boolean }) {
  const [saved, setSaved] = useState(cost.monthly_amount);
  const [text, setText] = useState(moneyInput.format(cost.monthly_amount));
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  async function commit() {
    if (text.trim() === moneyInput.format(saved)) return;
    setState({ kind: "saving" });
    const result = await updateFixedCostAmount(cost.id, text);
    if (result.ok && result.amount !== undefined) {
      setSaved(result.amount);
      setText(moneyInput.format(result.amount));
      setState({ kind: "saved" });
      setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
    } else if (!result.ok) {
      setState({ kind: "error", message: result.error });
    }
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-medium">{cost.name}</p>
        <span aria-hidden className="text-sm text-muted">
          R$
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          inputMode="decimal"
          disabled={!canWrite}
          aria-label={`Valor mensal de ${cost.name}`}
          aria-invalid={state.kind === "error"}
          className={`${smallInput} w-28`}
        />
        {canWrite ? (
          <form action={deleteFixedCost}>
            <input type="hidden" name="id" value={cost.id} />
            <ConfirmButton message={`Remover ${cost.name}?`} className="flex size-11 items-center justify-center rounded-xl text-xl leading-none text-muted">
              ×
            </ConfirmButton>
          </form>
        ) : null}
      </div>
      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-right text-xs">
        {state.kind === "saving" ? <span className="inline-flex items-center gap-1 text-muted"><Spinner className="size-3" />Salvando…</span> : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </li>
  );
}

/** Contas que quase toda marmitaria tem. Salário e pró-labore ficam em "Equipe". */
const SUGGESTED_COSTS = [
  "Aluguel",
  "Energia elétrica",
  "Água",
  "Gás",
  "Internet",
  "Plataforma de pedidos",
  "Contador",
  "Materiais de limpeza",
  "Combustível",
  "Vale-transporte / ajuda de custo",
  "Manutenção",
  "Anúncios",
  "Provisão de 13º e férias",
];

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function AddFixedCostForm({ existing }: { existing: string[] }) {
  const have = new Set(existing.map(plain));
  const suggestions = SUGGESTED_COSTS.filter((n) => !have.has(plain(n)));

  // O campo de nome continua livre: a pessoa pode tocar numa sugestão ou digitar uma conta nova.
  function pick(name: string, button: HTMLButtonElement) {
    const form = button.closest("form");
    const input = form?.querySelector<HTMLInputElement>('input[name="name"]');
    if (!input) return;
    input.value = name;
    form?.querySelector<HTMLInputElement>('input[name="amount"]')?.focus();
  }

  return (
    <ActionForm action={addFixedCost} submitLabel="Adicionar conta" resetOnOk>
      {suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Toque numa conta comum ou digite outra abaixo</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => pick(n, e.currentTarget)}
                className="min-h-10 rounded-full border border-border bg-background px-3.5 text-sm font-medium text-foreground active:bg-primary/10"
              >
                + {n}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <TextField label="Nome da conta" name="name" placeholder="Ex.: Aluguel, ou outra conta sua" />
      <TextField label="Quanto por mês (R$)" name="amount" inputMode="decimal" placeholder="Ex.: 1.500" />
    </ActionForm>
  );
}

const AREA_LABEL: Record<string, string> = { cozinha: "Cozinha", entrega: "Entrega", marketing: "Marketing", limpeza: "Limpeza", comercial: "Comercial", outros: "Outros" };

export function StaffRowView({
  person,
  canWrite,
}: {
  person: { id: string; name: string; area: string; monthly_salary: number; charges_pct: number };
  canWrite: boolean;
}) {
  const [salaryText, setSalaryText] = useState(moneyInput.format(person.monthly_salary));
  const [chargesText, setChargesText] = useState(pctText(person.charges_pct));
  const [salary, setSalary] = useState(person.monthly_salary);
  const [charges, setCharges] = useState(person.charges_pct);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });

  async function commit() {
    if (salaryText.trim() === moneyInput.format(salary) && chargesText.trim() === pctText(charges)) return;
    setState({ kind: "saving" });
    const result = await updateStaffPay(person.id, salaryText, chargesText);
    if (result.ok && result.salary !== undefined && result.charges !== undefined) {
      setSalary(result.salary);
      setCharges(result.charges);
      setSalaryText(moneyInput.format(result.salary));
      setChargesText(pctText(result.charges));
      setState({ kind: "saved" });
      setTimeout(() => setState((s) => (s.kind === "saved" ? { kind: "idle" } : s)), 2000);
    } else if (!result.ok) {
      setState({ kind: "error", message: result.error });
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{person.name}</p>
          <p className="text-xs text-muted">
            {AREA_LABEL[person.area] ?? person.area} · custa <strong className="tabular text-foreground">{formatBRL(salary * (1 + charges))}</strong> por mês
          </p>
        </div>
        {canWrite ? (
          <form action={deleteStaff}>
            <input type="hidden" name="id" value={person.id} />
            <ConfirmButton message={`Remover ${person.name}?`} className="flex size-11 items-center justify-center rounded-xl text-xl leading-none text-muted">
              ×
            </ConfirmButton>
          </form>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Salário (R$)
          <input value={salaryText} onChange={(e) => setSalaryText(e.target.value)} onBlur={commit} inputMode="decimal" disabled={!canWrite} className={`${smallInput} w-full text-foreground`} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
          Encargos (%)
          <input value={chargesText} onChange={(e) => setChargesText(e.target.value)} onBlur={commit} inputMode="decimal" disabled={!canWrite} className={`${smallInput} w-full text-foreground`} />
        </label>
      </div>
      <p role={state.kind === "error" ? "alert" : undefined} className="empty:hidden text-right text-xs">
        {state.kind === "saving" ? <span className="inline-flex items-center gap-1 text-muted"><Spinner className="size-3" />Salvando…</span> : null}
        {state.kind === "saved" ? <span className="text-success">Salvo ✓</span> : null}
        {state.kind === "error" ? <span className="text-danger">{state.message}</span> : null}
      </p>
    </li>
  );
}

export function AddStaffForm() {
  return (
    <ActionForm action={addStaff} submitLabel="Adicionar pessoa" resetOnOk>
      <TextField label="Nome" name="name" placeholder="Ex.: Maria (cozinheira) ou Pró-labore (você)" />
      <SelectField
        label="Área"
        name="area"
        defaultValue="cozinha"
        options={[
          { value: "cozinha", label: "Cozinha" },
          { value: "entrega", label: "Entrega" },
          { value: "marketing", label: "Marketing" },
          { value: "limpeza", label: "Limpeza" },
          { value: "comercial", label: "Comercial" },
          { value: "outros", label: "Outros" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Salário (R$)" name="salary" inputMode="decimal" placeholder="Ex.: 2.200" />
        <TextField
          label="Encargos (%)"
          name="charges"
          inputMode="decimal"
          required={false}
          placeholder="Ex.: 30"
          hint={<Hint>O que a pessoa custa além do salário (13º, férias, FGTS, INSS). Use o percentual que seu contador indicar. Sem encargos, deixe em branco.</Hint>}
        />
      </div>
    </ActionForm>
  );
}
