import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|api/keepalive$|api/menu/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
