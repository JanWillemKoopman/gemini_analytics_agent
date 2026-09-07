import Papa from "papaparse";

/**
 * Publiek Google Sheet — "Anyone with the link can view". Geen API-key nodig: de
 * gviz-export levert een CSV van één tabblad zonder authenticatie.
 * Overschrijfbaar via GOOGLE_SHEET_ID mocht het dashboard ooit naar een andere sheet
 * moeten wijzen (bv. een kopie voor een tweede vestiging).
 */
export const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "15v1fCY976qQ0vVSiAmyXqYoGJvAnismE66IQzrVuZKk";
export const SHEET_TAB = "Campagnes";

function csvUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
}

export type Campagne = {
  naam: string;
  budget: number | null;
  uitgaven: number | null;
  doelLeads: number | null;
  doelOrders: number | null;
  startdatum: string | null;
  einddatum: string | null;
  status: string;
  orderTotaal: number | null;
  ordersCampagne: number | null;
  leads: number | null;
  leadsMarketing: number | null;
  resultaat: string;
  merk: string;
  model: string;
  leadType: string;
  ordersoort: string;
  klantgroepOrders: string;
  doelLeadsMarketing: number | null;
  doelOrdersMarketing: number | null;
  campagnepagina: string;
  definitieLead: string;
};

/**
 * De sheet schrijft bedragen en aantallen in NL-notatie: "€ 3.000" (punt = duizendtal)
 * en "20,00" (komma = decimaal). Beide vormen komen via dezelfde kolommen binnen, dus één
 * parser voor allebei.
 */
function parseNumberNL(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getCampagnes(): Promise<Campagne[]> {
  const res = await fetch(csvUrl(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Kon de spreadsheet niet ophalen (status ${res.status})`);
  }
  const csv = await res.text();
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return data
    .filter((row) => row["Campagne naam"]?.trim())
    .map((row) => ({
      naam: row["Campagne naam"].trim(),
      budget: parseNumberNL(row["Budget"]),
      uitgaven: parseNumberNL(row["Uitgaven"]),
      doelLeads: parseNumberNL(row["Doel leads"]),
      doelOrders: parseNumberNL(row["Doel orders"]),
      startdatum: row["Startdatum"]?.trim() || null,
      einddatum: row["Einddatum"]?.trim() || null,
      status: row["Status"]?.trim() ?? "",
      orderTotaal: parseNumberNL(row["Order totaal"]),
      ordersCampagne: parseNumberNL(row["Orders campagne"]),
      leads: parseNumberNL(row["Leads"]),
      leadsMarketing: parseNumberNL(row["Leads marketing"]),
      resultaat: row["Resultaat"]?.trim() ?? "",
      merk: row["Merk"]?.trim() ?? "",
      model: row["Model"]?.trim() ?? "",
      leadType: row["Lead type"]?.trim() ?? "",
      ordersoort: row["Ordersoort"]?.trim() ?? "",
      klantgroepOrders: row["Klantgroep orders (indien van toepassing)"]?.trim() ?? "",
      doelLeadsMarketing: parseNumberNL(row["Doel leads marketing"]),
      doelOrdersMarketing: parseNumberNL(row["Doel orders marketing"]),
      campagnepagina: row["Campagnepagina"]?.trim() ?? "",
      definitieLead: row["Definitie lead"]?.trim() ?? "",
    }));
}
