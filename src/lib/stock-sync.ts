import "server-only";
import { stockBalance, type Movement } from "@/lib/calc/stock";
import { currentMonthStart, monthBounds } from "@/lib/month-view";
import { loadProductionBase } from "@/lib/production-data";
import { createClient } from "@/lib/supabase/server";

/**
 * O Estoque (agora) é o único lugar onde se conta, compra e dá baixa. O Histórico dos meses lê as tabelas mensais
 * (contagem no fim do mês, compras sem nota, marmitas prontas): esta função as mantém em dia, para ninguém digitar duas vezes.
 *
 * Regras (sempre do mês corrente):
 * - insumo contado no mês: a contagem do mês passa a ser o saldo de agora (última contagem + o que entrou e saiu depois dela);
 * - compras lançadas sem nota fiscal (e as marcadas na lista de compras da produção): soma do mês, sem repetir as das notas;
 * - marmitas prontas: valor ao custo do que há no freezer.
 * Nunca atrapalha a tela: qualquer falha aqui é ignorada (o estoque do dia a dia já foi salvo).
 */
export async function syncMonthFromLedger(orgId: string, unitId: string, input: { ingredientIds?: string[]; finished?: boolean }, now: Date = new Date()): Promise<void> {
  try {
    const supabase = await createClient();
    const month = currentMonthStart(now);
    const { start, end } = monthBounds(month);
    const inMonth = (iso: string) => {
      const t = Date.parse(iso);
      return t >= start.getTime() && t < end.getTime();
    };

    const ids = [...new Set(input.ingredientIds ?? [])];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("stock_movements")
        .select("ingredient_id, kind, qty_base, occurred_at, nfe_import_id")
        .eq("org_id", orgId)
        .eq("unit_id", unitId)
        .in("ingredient_id", ids)
        .order("occurred_at")
        .limit(5000);
      const byIngredient = new Map<string, { m: Movement; manualPurchase: boolean }[]>();
      for (const r of data ?? []) {
        const list = byIngredient.get(r.ingredient_id as string) ?? [];
        list.push({ m: { kind: r.kind as Movement["kind"], qty: Number(r.qty_base), at: r.occurred_at as string }, manualPurchase: r.kind === "purchase" && !r.nfe_import_id });
        byIngredient.set(r.ingredient_id as string, list);
      }
      for (const id of ids) {
        const list = byIngredient.get(id) ?? [];
        const countedThisMonth = list.some((x) => x.m.kind === "count" && inMonth(x.m.at));
        if (countedThisMonth) {
          const balance = Math.max(0, stockBalance(list.map((x) => x.m)).balance);
          await supabase.from("ingredient_stock_counts").upsert({ org_id: orgId, unit_id: unitId, ingredient_id: id, month, qty_base: balance }, { onConflict: "unit_id,ingredient_id,month" });
        }
        const manual = list.filter((x) => x.manualPurchase && inMonth(x.m.at)).reduce((s, x) => s + x.m.qty, 0);
        if (manual > 0) {
          const { data: row } = await supabase.from("ingredient_purchases").select("id").eq("unit_id", unitId).eq("ingredient_id", id).eq("month", month).eq("source", "manual").maybeSingle();
          if (row) await supabase.from("ingredient_purchases").update({ qty_base: manual }).eq("id", row.id).eq("org_id", orgId);
          else await supabase.from("ingredient_purchases").insert({ org_id: orgId, unit_id: unitId, ingredient_id: id, month, qty_base: manual, amount: 0, source: "manual" });
        }
      }
    }

    if (input.finished) {
      const base = await loadProductionBase(orgId, true);
      if (base) {
        const value = base.recipes.reduce((sum, r) => {
          const b = base.finished[r.id];
          return b?.known ? sum + Math.max(0, b.balance) * r.costPerPortion : sum;
        }, 0);
        await supabase.from("periods").upsert({ org_id: orgId, unit_id: unitId, month, finished_stock_value: Math.round(value * 100) / 100 }, { onConflict: "unit_id,month" });
      }
    }
  } catch {
    /* o histórico se atualiza no próximo lançamento */
  }
}
