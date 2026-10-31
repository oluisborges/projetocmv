import { formatBRL, formatNumber } from "@/lib/format";
import type { StockRow } from "@/lib/stock-view";

const show = (baseQty: number, perDisplay: number) => formatNumber(baseQty / perDisplay, 2);

/** Uma linha do histórico de um mês (só leitura): o que entrou, o que as fichas gastaram, o que deveria sobrar e o que foi contado. */
export function StockRowReadOnly({ row }: { row: StockRow }) {
  const u = row.displayUnit;
  const manual = row.purchased - row.purchasedNfe;
  // Sem estoque de partida nem compras lançadas, "deveria sobrar" sairia negativo e assustaria sem motivo.
  const noInflow = row.opening + row.purchased === 0;
  const { missingQty, missingValue } = row;

  return (
    <li className="flex flex-col gap-2 py-3">
      <p className="font-semibold leading-snug">{row.name}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <dt className="text-xs text-muted">Começou o mês com</dt>
          <dd className="tabular">{row.opening > 0 ? `${show(row.opening, row.perDisplay)} ${u}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Comprou</dt>
          <dd className="tabular">
            {row.purchased > 0 ? `${show(row.purchased, row.perDisplay)} ${u}` : "—"}
            {row.purchasedNfe > 0 && manual > 0 ? <span className="text-xs text-muted"> ({show(row.purchasedNfe, row.perDisplay)} em notas)</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">As fichas gastaram</dt>
          <dd className="tabular">{row.used > 0 ? `${show(row.used, row.perDisplay)} ${u}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Deveria sobrar</dt>
          {noInflow ? (
            <dd className="text-xs text-muted">precisa das compras</dd>
          ) : (
            <dd className={`tabular font-semibold ${row.expected < 0 ? "text-danger" : ""}`}>
              {show(row.expected, row.perDisplay)} {u}
            </dd>
          )}
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Contado no fim do mês</dt>
          <dd className="tabular">{row.counted !== null ? `${show(row.counted, row.perDisplay)} ${u}` : "não contado"}</dd>
        </div>
      </dl>

      {!noInflow && missingQty !== null && missingValue !== null ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${Math.abs(missingValue) < 5 ? "bg-success/10" : missingValue > 0 ? "bg-danger/10" : "bg-warning/10"}`}>
          {Math.abs(missingValue) < 5 ? (
            <>Bateu com o esperado.</>
          ) : missingValue > 0 ? (
            <>
              Faltaram <strong className="tabular">{show(missingQty, row.perDisplay)} {u}</strong> que as vendas não explicam: <strong className="tabular">{formatBRL(missingValue)}</strong> a preço de hoje.
            </>
          ) : (
            <>
              Sobrou <strong className="tabular">{show(-missingQty, row.perDisplay)} {u}</strong> a mais que o esperado ({formatBRL(-missingValue)}). Pode ter faltado lançar uma compra ou a ficha usa mais do que o real.
            </>
          )}
        </p>
      ) : null}
    </li>
  );
}
