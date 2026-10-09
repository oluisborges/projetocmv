import { createBrowserClient } from "@supabase/ssr";

/** Cliente do Supabase para Client Components. Só usa a chave pública; o acesso é limitado pelo RLS. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
