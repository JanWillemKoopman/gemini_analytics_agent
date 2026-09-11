import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client: omzeilt RLS volledig, dus dit bestand mag NOOIT
// geïmporteerd worden in client components of iets dat naar de browser wordt gestuurd —
// alleen vanuit route handlers (zoals /api/settings/*), net als lib/supabase/server.ts.
// Gebruikt voor gebruikersbeheer via de Supabase Auth admin-API en het
// instellingen-tabelletje mmm.app_settings.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ontbreekt. Zet deze (server-only, nooit NEXT_PUBLIC_) in " +
        "de omgevingsvariabelen — te vinden in Supabase onder Project Settings → API.",
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
