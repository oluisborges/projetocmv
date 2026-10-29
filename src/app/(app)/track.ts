"use server";

import { describePath } from "@/lib/activity";
import { getActiveOrg, getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Registra que a pessoa abriu uma tela (histórico de uso, visível só para o admin Shogun). Nunca atrapalha a navegação. */
export async function trackPageView(path: string): Promise<void> {
  try {
    const summary = describePath(String(path));
    if (!summary) return;
    const [session, org] = await Promise.all([getSession(), getActiveOrg()]);
    if (!session || !org) return;

    const supabase = await createClient();
    await supabase.from("activity_log").insert({
      org_id: org.orgId,
      user_id: session.userId,
      by_admin: session.isStaff,
      kind: "view",
      summary,
      path: String(path).split("?")[0].slice(0, 200),
    });
  } catch {
    /* ignora */
  }
}
