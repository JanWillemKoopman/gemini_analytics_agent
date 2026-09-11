import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client: omzeilt alle rijbeveiliging. Alleen gebruiken vanuit
 * route handlers (zoals /api/gebruikers/*), nooit in een client component. Zelfde
 * sleutel als scripts/maak-gebruiker.ts (zie README-dataloket.md) — hier ingezet vanuit
 * de app zelf voor de Instellingen-pagina, zodat collega-accounts niet meer los via het
 * script hoeven te worden aangemaakt.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ontbreekt. Zie README-dataloket.md — te vinden in " +
        "Supabase onder Project Settings → API → service_role secret.",
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
