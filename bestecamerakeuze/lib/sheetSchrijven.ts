import { google } from "googleapis";
import { SHEET_ID, SHEET_TAB } from "@/lib/sheet";

/**
 * Whitelist van velden die vanuit het dashboard terug naar de sheet geschreven mogen
 * worden, met de exacte kolomkop erbij. Leads, Online leads (kolom "Leads marketing")
 * en Orders (kolom "Order totaal") staan hier bewust niet in: die cijfers komen ergens
 * anders vandaan en horen niet handmatig overschreven te worden.
 */
const SCHRIJFBARE_VELDEN: Record<string, string> = {
  startdatum: "Startdatum",
  einddatum: "Einddatum",
  budget: "Budget",
  uitgaven: "Uitgaven",
  doelLeads: "Doel leads",
  doelOrders: "Doel orders",
};

export function isSchrijfbaarVeld(veld: string): boolean {
  return veld in SCHRIJFBARE_VELDEN;
}

export function isSheetsSchrijvenGeconfigureerd(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) {
    throw new Error(
      "Schrijven naar de sheet is niet geconfigureerd (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ontbreken).",
    );
  }
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** A1-kolomletter uit een 0-based kolomindex (0 → A, 25 → Z, 26 → AA, ...). */
function kolomLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/**
 * Schrijft één celwaarde terug naar de "Campagnes"-sheet, gevonden op basis van de
 * kolomkop (niet een vaste kolomletter) en de campagnenaam (niet een vast rijnummer) —
 * zodat het blijft werken als iemand in de sheet zelf kolommen of rijen verschuift.
 * `valueInputOption: "USER_ENTERED"` laat Sheets de waarde net zo interpreteren als
 * wanneer je 'm zelf in de cel zou typen (inclusief het bestaande celformaat), in
 * plaats van hem altijd als platte tekst weg te schrijven.
 */
export async function schrijfVeld(campagneNaam: string, veld: string, waarde: string): Promise<void> {
  const kolomNaam = SCHRIJFBARE_VELDEN[veld];
  if (!kolomNaam) {
    throw new Error(`Veld "${veld}" mag niet vanuit het dashboard aangepast worden.`);
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:Z`,
  });
  const rows = data.values ?? [];
  if (rows.length === 0) {
    throw new Error("Tabblad “Campagnes” lijkt leeg.");
  }

  const header = rows[0];
  const kolomIndex = header.indexOf(kolomNaam);
  const campagneKolomIndex = header.indexOf("Campagne naam");
  if (kolomIndex === -1 || campagneKolomIndex === -1) {
    throw new Error(`Kolom "${kolomNaam}" of "Campagne naam" niet gevonden in de sheet.`);
  }

  const rijIndex = rows.findIndex(
    (row, i) => i > 0 && row[campagneKolomIndex]?.trim() === campagneNaam,
  );
  if (rijIndex === -1) {
    throw new Error(`Campagne "${campagneNaam}" niet gevonden in de sheet.`);
  }

  const cel = `${kolomLetter(kolomIndex)}${rijIndex + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!${cel}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[waarde]] },
  });
}
