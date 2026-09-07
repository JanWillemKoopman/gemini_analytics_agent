import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * De vraagbibliotheek: welke vragen stelt het team het vaakst?
 *
 * Bedoeld als leermiddel, niet als ranglijst. Wie voor het eerst met de chat werkt weet
 * niet wat een zinnige vraag is; de vragen van collega's zijn daarvoor het beste
 * voorbeeld dat er is — en beter dan de bedachte voorbeeldvragen die er eerst stonden.
 *
 * Leest de geaggregeerde view uit migratie 0007, niet de querylog zelf: die blijft per
 * gebruiker afgeschermd, want dit is expliciet geen middel om te zien wie wat vroeg.
 */
export interface PopulaireVraag {
  vraag: string;
  aantal: number;
  laatstGesteld: string;
}

export async function haalPopulaireVragen(
  supabase: SupabaseClient,
  limiet = 6,
): Promise<PopulaireVraag[]> {
  const { data, error } = await supabase
    .schema("dataloket")
    .from("v_populaire_vragen")
    .select("vraag, aantal, laatst_gesteld")
    .order("aantal", { ascending: false })
    .order("laatst_gesteld", { ascending: false })
    .limit(limiet);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    vraag: r.vraag as string,
    aantal: r.aantal as number,
    laatstGesteld: r.laatst_gesteld as string,
  }));
}
