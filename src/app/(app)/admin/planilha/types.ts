import type { RowError } from "@/lib/sheet-import";

export type SheetKind = "insumos" | "fichas";

export type SheetPreview =
  | {
      ok: true;
      kind: "insumos";
      rows: { line: number; name: string; unit: string; assumed: boolean; qty: number; price: number; category: string | null; status: "new" | "exists" }[];
      errors: RowError[];
    }
  | {
      ok: true;
      kind: "fichas";
      recipes: { name: string; items: number; status: "new" | "exists" | "missing"; missing: string[] }[];
      errors: RowError[];
    }
  | { ok: false; error: string };

export type SheetApplyResult = { ok: true; message: string } | { ok: false; error: string };
