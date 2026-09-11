import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotitieSoort } from "@/lib/notities";

/**
 * Aantekeningen per campagne — zie supabase/migrations/0005_campagne_notities.sql en
 * 0007_besluitenlog_prikbord_vragen.sql. Gekoppeld op de campagnenaam uit de Google
 * Sheet, niet op een database-id: de campagnes zelf leven niet in deze database.
 *
 * Sinds het besluitenlogboek is een aantekening meer dan tekst: hij heeft een soort
 * (observatie/hypothese/besluit/actie) en, bij een hypothese of besluit, de metriek die
 * erdoor zou moeten veranderen plus de stand van die metriek op het moment van
 * vastleggen. Dat laatste getal is het nulpunt waartegen het dashboard later de
 * actuele waarde afzet.
 */
export interface CampagneNotitie {
  id: string;
  campagneNaam: string;
  tekst: string;
  soort: NotitieSoort;
  metriek: string | null;
  metriekWaarde: number | null;
  afgerondOp: string | null;
  aangemaaktDoor: string;
  aangemaaktOp: string;
  bijgewerktOp: string;
}

export interface NieuweNotitie {
  campagneNaam: string;
  tekst: string;
  soort: NotitieSoort;
  metriek: string | null;
  metriekWaarde: number | null;
}

const SCHEMA = "dataloket";
const TABEL = "campagne_notities";
const KOLOMMEN =
  "id, campagne_naam, tekst, soort, metriek, metriek_waarde, afgerond_op, aangemaakt_door, aangemaakt_op, bijgewerkt_op";

function naarItem(r: Record<string, unknown>): CampagneNotitie {
  const waarde = r.metriek_waarde;
  return {
    id: r.id as string,
    campagneNaam: r.campagne_naam as string,
    tekst: r.tekst as string,
    soort: (r.soort as NotitieSoort) ?? "observatie",
    metriek: (r.metriek as string | null) ?? null,
    // numeric komt als string terug uit PostgREST; één keer hier omzetten scheelt
    // parseFloat-aanroepen door de hele UI heen.
    metriekWaarde: waarde === null || waarde === undefined ? null : Number(waarde),
    afgerondOp: (r.afgerond_op as string | null) ?? null,
    aangemaaktDoor: r.aangemaakt_door as string,
    aangemaaktOp: r.aangemaakt_op as string,
    bijgewerktOp: r.bijgewerkt_op as string,
  };
}

export async function lijstNotities(
  supabase: SupabaseClient,
  campagneNaam: string,
): Promise<CampagneNotitie[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .eq("campagne_naam", campagneNaam)
    .order("aangemaakt_op", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(naarItem);
}

/**
 * Alle aantekeningen over alle campagnes heen, nieuwste eerst — de bron van het tabblad
 * "Kennis en acties". Dezelfde rijen als `lijstNotities`, alleen niet op één campagne
 * gefilterd: het overzicht bestaat juist om te zien wat er teamsbreed is vastgelegd.
 *
 * Bewust begrensd (default 500). Het scorebord kijkt maximaal 60 dagen terug en de tabel
 * is een leeslijst, geen archief; een ongelimiteerde select wordt met de jaren vanzelf
 * een trage pagina.
 */
export async function lijstAlleNotities(
  supabase: SupabaseClient,
  limiet = 500,
): Promise<CampagneNotitie[]> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .select(KOLOMMEN)
    .order("aangemaakt_op", { ascending: false })
    .limit(limiet);
  if (error) throw new Error(error.message);
  return (data ?? []).map(naarItem);
}

export async function maakNotitie(
  supabase: SupabaseClient,
  gebruikerId: string,
  nieuw: NieuweNotitie,
): Promise<CampagneNotitie> {
  const { data, error } = await supabase
    .schema(SCHEMA)
    .from(TABEL)
    .insert({
      campagne_naam: nieuw.campagneNaam,
      tekst: nieuw.tekst,
      soort: nieuw.soort,
      metriek: nieuw.metriek,
      metriek_waarde: nieuw.metriekWaarde,
      aangemaakt_door: gebruikerId,
      bijgewerkt_door: gebruikerId,
    })
    .select(KOLOMMEN)
    .single();
  if (error) throw new Error(error.message);
  return naarItem(data);
}

export async function wijzigNotitie(
  supabase: SupabaseClient,
  gebruikerId: string,
  id: string,
  wijziging: { tekst?: string; afgerond?: boolean },
): Promise<void> {
  const velden: Record<string, unknown> = { bijgewerkt_door: gebruikerId };
  if (wijziging.tekst !== undefined) velden.tekst = wijziging.tekst;
  if (wijziging.afgerond !== undefined) {
    velden.afgerond_op = wijziging.afgerond ? new Date().toISOString() : null;
  }
  const { error } = await supabase.schema(SCHEMA).from(TABEL).update(velden).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function verwijderNotitie(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.schema(SCHEMA).from(TABEL).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
