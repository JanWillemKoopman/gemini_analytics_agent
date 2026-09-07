import Papa from "papaparse";

/**
 * De sheets die naar Postgres gekopieerd worden.
 *
 * Sjabloon: zodra je de links deelt, komt hier per sheet één regel in de `BRONNEN`-lijst
 * te staan. De rest van de sync-machinerie (validatie, afwijkingen, logging) hoeft dan
 * niet meer aangepast te worden.
 *
 * Waarom kopiëren en niet live lezen: met een kopie in Postgres kun je joinen, filteren
 * in SQL, en straks Ads- en Selligent-data naast verkoopdata leggen. Bij duizenden rijen
 * is een volledige verversing per nacht het simpelst en het betrouwbaarst.
 */

export interface Bron {
  /** Sleutel in de logging; ook de naam die in sync_runs verschijnt. */
  naam: string;
  /** Id uit de sheet-URL. */
  sheetId: string;
  /** Naam van het tabblad. */
  tabblad: string;
  /** Doeltabel in het dataloket-schema. */
  doeltabel: string;
  /**
   * Kolom die een rij uniek maakt — nodig om te kunnen upserten. Moet zowel in
   * `kolommen` als sheetkolom voorkomen als (na mapping) een echte databasekolom zijn,
   * want deze naam wordt letterlijk in de `on conflict (...)`-clausule gebruikt.
   *
   * Heeft de bron geen natuurlijke sleutel (geen lead- of order-ID in de sheet)? Gebruik
   * dan `"regelnummer"` — die kolom wordt door de sync zelf gevuld met het rijnummer uit
   * de sheet (zie route.ts) en is dus altijd aanwezig en uniek binnen één sync-run. Zet
   * hem ook als `"regelnummer": "regelnummer"` in `kolommen`. Let op: zo'n sleutel is
   * geen stabiel ID over syncs heen — bij elke nachtelijke verversing herbegint de
   * telling, wat prima is omdat de tabel dan toch al leeggemaakt en opnieuw gevuld wordt.
   */
  sleutelKolom: string;
  /**
   * Sheetkolom die niet leeg mag zijn, anders wordt de rij afgekeurd. Los van
   * `sleutelKolom`, want bij een gegenereerde sleutel (`regelnummer`) is die zelf nooit
   * leeg — dan bepaalt dit veld pas welke rijen echt data bevatten (bijvoorbeeld lege
   * paddingrijen uit de sheet weglaten). Standaard: `sleutelKolom` zelf.
   */
  vereisteKolom?: string;
  /**
   * Van sheetkolom naar databasekolom. Kolommen die hier niet in staan worden genegeerd,
   * wat meteen de manier is om velden die de AI niet hoeft te zien buiten de database te
   * houden.
   */
  kolommen: Record<string, string>;
}

/**
 * Beide bronnen zijn tabbladen van dezelfde spreadsheet als de Campagnes-tab
 * (zie SHEET_ID in lib/sheet.ts) — alleen leest deze sync ze naar Postgres in plaats van
 * live in te laden, zodat de chat er SQL op kan draaien.
 *
 * Geen van beide tabbladen heeft een natuurlijke unieke sleutel (geen lead- of
 * order-ID), dus beide gebruiken de gegenereerde "regelnummer"-sleutel (zie
 * sleutelKolom in bronnen.ts en de toelichting daar).
 */
export const BRONNEN: Bron[] = [
  {
    naam: "Data leads",
    sheetId: "15v1fCY976qQ0vVSiAmyXqYoGJvAnismE66IQzrVuZKk",
    tabblad: "Data leads",
    doeltabel: "leads_raw",
    sleutelKolom: "regelnummer",
    // De sheet exporteert daarnaast tienduizenden volledig lege paddingrijen (geen
    // kanaal, merk of datum). "Kanaal" is leeg, is de rij géén echte lead.
    vereisteKolom: "Kanaal",
    kolommen: {
      regelnummer: "regelnummer",
      Kanaal: "kanaal",
      Kanaalgroep: "kanaalgroep",
      Ordersoort: "ordersoort",
      Onderwerp: "onderwerp",
      Merk: "merk",
      Model: "model",
      Sluitreden: "sluitreden",
      Klantsoort: "klantsoort",
      Aangelegd: "aangelegd_ruw",
      Campagnes: "campagne",
      "Lead Type": "lead_type",
      Orders: "order_geworden_ruw",
    },
  },
  {
    naam: "Data orders 2",
    sheetId: "15v1fCY976qQ0vVSiAmyXqYoGJvAnismE66IQzrVuZKk",
    tabblad: "Data orders 2",
    doeltabel: "orders_raw",
    sleutelKolom: "regelnummer",
    kolommen: {
      regelnummer: "regelnummer",
      "Nieuw / gebruikt": "ordersoort",
      Merk: "merk",
      Model: "model",
      "Aantal auto's": "aantal_ruw",
      Aangelegd: "aangelegd_ruw",
      Campagnes: "campagne",
    },
  },
];

export function csvUrl(bron: Bron): string {
  return (
    `https://docs.google.com/spreadsheets/d/${bron.sheetId}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(bron.tabblad)}`
  );
}

/**
 * NL-notatie omzetten: "€ 3.000,50" → 3000.5. De sheets schrijven bedragen met een punt
 * als duizendtalscheiding en een komma als decimaalteken.
 */
export function parseGetalNL(waarde: string | undefined): number | null {
  if (!waarde) return null;
  const schoon = waarde.trim().replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (schoon === "") return null;
  const n = Number(schoon);
  return Number.isFinite(n) ? n : null;
}

/** "31-12-2025" of "2025-12-31" → "2025-12-31". Geeft null bij iets onherkenbaars. */
export function parseDatumNL(waarde: string | undefined): string | null {
  if (!waarde) return null;
  const s = waarde.trim();
  if (s === "") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const nl = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (nl) {
    const [, d, m, j] = nl;
    return `${j}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export interface GeparsteRij {
  rijnummer: number;
  waarden: Record<string, string>;
}

export async function haalSheetOp(bron: Bron): Promise<GeparsteRij[]> {
  const res = await fetch(csvUrl(bron), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Kon sheet "${bron.naam}" niet ophalen (status ${res.status})`);
  }
  const csv = await res.text();
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  // +2: rij 1 is de kop, en mensen tellen vanaf 1 — zo verwijst het rijnummer in een
  // afwijkingsmelding naar de regel die je in de sheet ziet staan.
  return data.map((waarden, i) => ({ rijnummer: i + 2, waarden }));
}
