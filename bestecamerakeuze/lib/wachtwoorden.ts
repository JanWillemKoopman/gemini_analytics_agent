import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Laatst bekende wachtwoord per account, in leesbare vorm — zie
 * supabase/migrations/0012_gebruikers_wachtwoorden.sql. Alleen bereikbaar via de
 * service-role-client (lib/supabase/admin.ts); de admin-check (isBeheerder) zit in de
 * aanroepende /api/gebruikers-routes, niet hier.
 */
const SCHEMA = "dataloket";
const TABEL = "gebruikers_wachtwoorden";

export async function haalWachtwoorden(
  admin: SupabaseClient,
  ids: string[],
): Promise<Record<string, string>> {
  const unieke = Array.from(new Set(ids));
  if (unieke.length === 0) return {};

  const { data, error } = await admin
    .schema(SCHEMA)
    .from(TABEL)
    .select("id, wachtwoord")
    .in("id", unieke);
  if (error) throw new Error(error.message);

  const resultaat: Record<string, string> = {};
  for (const rij of data ?? []) {
    resultaat[rij.id as string] = rij.wachtwoord as string;
  }
  return resultaat;
}

export async function zetWachtwoord(
  admin: SupabaseClient,
  gebruikerId: string,
  wachtwoord: string,
): Promise<void> {
  const { error } = await admin
    .schema(SCHEMA)
    .from(TABEL)
    .upsert({ id: gebruikerId, wachtwoord }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}
