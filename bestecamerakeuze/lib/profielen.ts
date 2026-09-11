import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Naam + avatar per collega — zie supabase/migrations/0006_profielen.sql. Gedeeld
 * leesbaar (nodig om aantekeningen aan een naam/foto te koppelen), alleen de eigenaar
 * mag zijn eigen profiel wijzigen.
 */
export interface Profiel {
  id: string;
  naam: string | null;
  avatarUrl: string | null;
}

const SCHEMA = "dataloket";
const TABEL = "profielen";
const KOLOMMEN = "id, naam, avatar_url";

function naarProfiel(r: Record<string, unknown>): Profiel {
  return {
    id: r.id as string,
    naam: (r.naam as string | null) ?? null,
    avatarUrl: (r.avatar_url as string | null) ?? null,
  };
}

export async function haalProfiel(
  supabase: SupabaseClient,
  id: string,
): Promise<Profiel | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? naarProfiel(data) : null;
}

/** Haalt meerdere profielen in één keer op, bv. voor een lijst aantekeningen. */
export async function haalProfielen(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Record<string, Profiel>> {
  const unieke = Array.from(new Set(ids));
  if (unieke.length === 0) return {};

  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .in("id", unieke);
  if (error) throw new Error(error.message);

  const resultaat: Record<string, Profiel> = {};
  for (const rij of data ?? []) {
    const profiel = naarProfiel(rij);
    resultaat[profiel.id] = profiel;
  }
  return resultaat;
}

/**
 * Alle profielen — nodig voor het scorebord op "Kennis en acties", dat iedere collega op
 * de rij zet en niet alleen wie deze maand iets heeft vastgelegd. Een lege plek op dat
 * rijtje is precies de zachte duw die de functie moet geven.
 */
export async function haalAlleProfielen(supabase: SupabaseClient): Promise<Profiel[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .order("naam", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(naarProfiel);
}

export async function wijzigEigenProfiel(
  supabase: SupabaseClient,
  gebruikerId: string,
  invoer: Partial<Pick<Profiel, "naam" | "avatarUrl">>,
): Promise<Profiel> {
  const velden: Record<string, unknown> = {};
  if (invoer.naam !== undefined) velden.naam = invoer.naam;
  if (invoer.avatarUrl !== undefined) velden.avatar_url = invoer.avatarUrl;

  // upsert: de trigger op auth.users maakt de rij normaal al aan, maar dit blijft
  // werken als die om wat voor reden dan ook nog niet gedraaid heeft.
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .upsert({ id: gebruikerId, ...velden }, { onConflict: "id" })
    .select(KOLOMMEN)
    .single();
  if (error) throw new Error(error.message);
  return naarProfiel(data);
}
