import type { SupabaseClient } from "@supabase/supabase-js";
import type { Weergave } from "@/components/chat/Visual";

/**
 * Het prikbord: grafieken uit de chat die het team wil bewaren.
 *
 * Het idee erachter is dat het dashboard groeit uit de vragen die het team écht stelt.
 * Blijkt een antwoord uit de chat elke week relevant, dan hoort het niet in een gesprek
 * te blijven zitten maar op een bord dat je met z'n allen opent.
 *
 * Per item bewaren we zowel de query als de uitkomst op het moment van vastpinnen. De
 * momentopname zorgt dat het bord altijd iets toont; "verversen" draait dezelfde SQL
 * opnieuw langs dezelfde guard en dezelfde read-only rol als de chat (zie dataQuery.ts).
 */
export interface PrikbordItem {
  id: string;
  titel: string;
  vraag: string | null;
  sql: string;
  weergave: Weergave;
  kolommen: string[];
  rijen: Record<string, unknown>[];
  ververstOp: string;
  aangemaaktDoor: string;
  aangemaaktOp: string;
}

export interface NieuwPrikbordItem {
  titel: string;
  vraag: string | null;
  sql: string;
  weergave: Weergave;
  kolommen: string[];
  rijen: Record<string, unknown>[];
}

const SCHEMA = "dataloket";
const TABEL = "prikbord";
const KOLOMMEN =
  "id, titel, vraag, sql, weergave, kolommen, rijen, ververst_op, aangemaakt_door, aangemaakt_op";

function naarItem(r: Record<string, unknown>): PrikbordItem {
  return {
    id: r.id as string,
    titel: r.titel as string,
    vraag: (r.vraag as string | null) ?? null,
    sql: r.sql as string,
    weergave: r.weergave as Weergave,
    kolommen: (r.kolommen as string[]) ?? [],
    rijen: (r.rijen as Record<string, unknown>[]) ?? [],
    ververstOp: r.ververst_op as string,
    aangemaaktDoor: r.aangemaakt_door as string,
    aangemaaktOp: r.aangemaakt_op as string,
  };
}

export async function lijstPrikbord(supabase: SupabaseClient): Promise<PrikbordItem[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .order("aangemaakt_op", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(naarItem);
}

export async function pinVast(
  supabase: SupabaseClient,
  gebruikerId: string,
  nieuw: NieuwPrikbordItem,
): Promise<PrikbordItem> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .insert({
      titel: nieuw.titel,
      vraag: nieuw.vraag,
      sql: nieuw.sql,
      weergave: nieuw.weergave,
      kolommen: nieuw.kolommen,
      rijen: nieuw.rijen,
      aangemaakt_door: gebruikerId,
    })
    .select(KOLOMMEN)
    .single();
  if (error) throw new Error(error.message);
  return naarItem(data);
}

export async function haalPrikbordItem(
  supabase: SupabaseClient,
  id: string,
): Promise<PrikbordItem | null> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? naarItem(data) : null;
}

/** Na een herdraaide query: nieuwe uitkomst en nieuw tijdstempel. */
export async function bewaarVerversing(
  supabase: SupabaseClient,
  id: string,
  kolommen: string[],
  rijen: Record<string, unknown>[],
): Promise<PrikbordItem> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .update({ kolommen, rijen, ververst_op: new Date().toISOString() })
    .eq("id", id)
    .select(KOLOMMEN)
    .single();
  if (error) throw new Error(error.message);
  return naarItem(data);
}

export async function verwijderPrikbordItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.schema(SCHEMA).from(TABEL).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
