import "server-only";
import { baseUnitOf, isPurchaseUnit } from "@/lib/calc";
import { monthBounds } from "@/lib/month-view";
import { isMoveKind, type MoveRow } from "@/lib/stock-moves";
import { createClient } from "@/lib/supabase/server";

const LIMIT = 500;

type Row = { id: string; ingredient_id: string | null; recipe_id: string | null; kind: string; qty_base: unknown; occurred_at: string; note: string | null; paid_amount?: unknown };

/** Os movimentos do estoque de um mês (do mais novo para o mais antigo), já com o nome do insumo ou da marmita. */
export async function loadMoves(orgId: string, unitId: string, month: string): Promise<{ rows: MoveRow[]; truncated: boolean }> {
  const supabase = await createClient();
  const { start, end } = monthBounds(month);
  const { data } = await supabase
    .from("stock_movements")
    .select("id, ingredient_id, recipe_id, kind, qty_base, occurred_at, note, paid_amount")
    .eq("org_id", orgId)
    .eq("unit_id", unitId)
    .gte("occurred_at", start.toISOString())
    .lt("occurred_at", end.toISOString())
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMIT + 1);
  const list = ((data ?? []) as Row[]).slice(0, LIMIT);

  const ingredientIds = [...new Set(list.flatMap((r) => (r.ingredient_id ? [r.ingredient_id] : [])))];
  const recipeIds = [...new Set(list.flatMap((r) => (r.recipe_id ? [r.recipe_id] : [])))];
  const [{ data: ings }, { data: recs }] = await Promise.all([
    ingredientIds.length ? supabase.from("ingredients").select("id, name, purchase_unit").eq("org_id", orgId).in("id", ingredientIds) : Promise.resolve({ data: [] as { id: string; name: string; purchase_unit: string }[] }),
    recipeIds.length ? supabase.from("recipes").select("id, name").eq("org_id", orgId).in("id", recipeIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const ingredient = new Map((ings ?? []).map((i) => [i.id as string, i as { name: string; purchase_unit: string }]));
  const recipe = new Map((recs ?? []).map((r) => [r.id as string, r.name as string]));

  const rows: MoveRow[] = list.flatMap((r) => {
    if (!isMoveKind(r.kind)) return [];
    const ing = r.ingredient_id ? ingredient.get(r.ingredient_id) : undefined;
    const name = r.recipe_id ? recipe.get(r.recipe_id) : ing?.name;
    if (!name) return [];
    return [
      {
        id: r.id,
        at: r.occurred_at,
        kind: r.kind,
        name,
        baseUnit: r.recipe_id ? ("un" as const) : ing && isPurchaseUnit(ing.purchase_unit) ? baseUnitOf(ing.purchase_unit) : ("g" as const),
        finished: r.recipe_id !== null,
        qty: Number(r.qty_base),
        note: r.note,
        paid: r.paid_amount === null || r.paid_amount === undefined ? null : Number(r.paid_amount),
      },
    ];
  });
  return { rows, truncated: (data ?? []).length > LIMIT };
}
