"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Dá baixa em um tipo de erro. Se ele acontecer de novo, volta sozinho para a lista. */
export async function resolveError(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await createAdminClient().from("error_events").update({ resolved_at: new Date().toISOString() }).eq("id", id.data).is("resolved_at", null);
  revalidatePath("/admin/erros");
}

export async function resolveAllErrors(): Promise<void> {
  await requireAdmin();
  await createAdminClient().from("error_events").update({ resolved_at: new Date().toISOString() }).is("resolved_at", null);
  revalidatePath("/admin/erros");
}
