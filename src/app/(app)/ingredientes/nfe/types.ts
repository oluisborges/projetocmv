import type { PurchaseUnit } from "@/lib/calc";

export type NfeIngredient = { id: string; name: string; purchase_qty: number; purchase_unit: PurchaseUnit; purchase_price: number };

export type NfeChoice = "update" | "create" | "ignore" | "skip";

export type NfePreviewItem = {
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  total: number;
  /** O que o sistema lembra de notas anteriores deste fornecedor. */
  remembered: { choice: "update" | "ignore"; ingredientId: string | null; packQty: number | null; packUnit: PurchaseUnit | null } | null;
  /** Sugestão pelo nome, quando nada foi lembrado. */
  suggestedId: string | null;
};

export type NfePreviewNote = {
  fileName: string;
  accessKey: string;
  number: string | null;
  supplierName: string;
  supplierCnpj: string;
  issuedAt: string;
  total: number;
  alreadyImported: boolean;
  items: NfePreviewItem[];
};

export type NfePreview = { ok: true; notes: NfePreviewNote[]; ingredients: NfeIngredient[]; problems: string[] } | { ok: false; error: string };

export type NfeDecision = {
  code: string;
  choice: NfeChoice;
  ingredientId?: string;
  packQty?: number;
  packUnit?: PurchaseUnit;
};

export type NfeApplyNote = { accessKey: string; addToPurchases: boolean; decisions: NfeDecision[] };

export type NfeApplyResult = { ok: true; message: string } | { ok: false; error: string };
