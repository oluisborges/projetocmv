"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, VIEW_AS_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/login");
}

/** Admin Shogun passa a ver o app como a marmitaria escolhida (com permissão de editar). */
export async function viewAsOrganization(formData: FormData) {
  await requireAdmin();
  const orgId = z.uuid().safeParse(formData.get("orgId"));
  if (!orgId.success) redirect("/admin");

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").eq("id", orgId.data).maybeSingle();
  if (!org) redirect("/admin");

  (await cookies()).set(VIEW_AS_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2, // some sozinho em 2 horas
  });
  redirect("/");
}

export async function exitViewAs() {
  (await cookies()).delete(VIEW_AS_COOKIE);
  redirect("/admin");
}
