import { google } from "googleapis";
import { SHEET_ID, SHEET_TAB } from "@/lib/sheet";

/**
 * Whitelist van velden die vanuit het dashboard terug naar de sheet geschreven mogen
 * worden, met de exacte kolomkop erbij. Leads, Online leads (kolom "Leads marketing")
 * en Orders (kolom "Order totaal") staan hier bewust niet in: die cijfers komen ergens
 * anders vandaan en horen niet handmatig overschreven te worden.
 */
const SCHRIJFBARE_VELDEN: Record<string, string> = {
  naam: "Campagne naam",
  startdatum: "Startdatum",
  einddatum: "Einddatum",
  budget: "Budget",
  uitgaven: "Uitgaven",
  doelLeads: "Doel leads",
  doelOrders: "Doel orders",
  merk: "Merk",
  model: "Model",
  leadType: "Lead type",
  ordersoort: "Ordersoort",
  klantgroepOrders: "Klantgroep orders (indien van toepassing)",
};

export function isSchrijfbaarVeld(veld: string): boolean {
  return veld in SCHRIJFBARE_VELDEN;
}

export function isSheetsSchrijvenGeconfigureerd(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

/**
 * Maakt de geplakte private key weer tot geldige PEM, ongeacht hoe hij precies is
 * opgeslagen: sommige env-UI's (waaronder Vercel) bewaren de waarde inclusief
 * omringende aanhalingstekens als je die zelf meeplakt, en de \n's uit het
 * JSON-keybestand overleven de copy-paste soms als letterlijke `\n` en soms als
 * echte regeleindes.
 */
function normaliseerPrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKeyRaw) {
    throw new Error(
      "Schrijven naar de sheet is niet geconfigureerd (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ontbreken).",
    );
  }

  const privateKey = normaliseerPrivateKey(privateKeyRaw);
  if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY bevat geen geldige PEM-sleutel. Plak de volledige `private_key` " +
        'uit het JSON-keybestand van het service account, inclusief de regels "-----BEGIN PRIVATE KEY-----" ' +
        'en "-----END PRIVATE KEY-----", zonder omringende aanhalingstekens, en herstart de deployment.',
    );
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/**
 * Vertaalt een mislukte Google-aanroep naar een begrijpelijke foutmelding. De rauwe
 * OpenSSL-fout ("error:1E08010C:DECODER routines::unsupported") die Node geeft zodra de
 * private key niet als geldige PEM te lezen is, zegt een gebruiker niets — die wijst
 * hem hier expliciet naar de env-variabele die het probleem veroorzaakt.
 */
function vertaalAuthFout(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("DECODER routines") || message.includes("unsupported")) {
    return new Error(
      "De GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY-omgevingsvariabele kon niet gelezen worden als geldige sleutel. " +
        "Kopieer de `private_key` opnieuw uit het JSON-keybestand van het service account en herstart de deployment.",
    );
  }
  return err instanceof Error ? err : new Error(message);
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

  try {
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
  } catch (err) {
    throw vertaalAuthFout(err);
  }
}

/** Alle velden die het nieuwe-campagneformulier mag invullen, min de naam (die heeft een eigen verplichte plek). */
export type NieuweCampagneVelden = {
  naam: string;
} & Partial<Record<Exclude<keyof typeof SCHRIJFBARE_VELDEN, "naam">, string>>;

/**
 * Voegt een nieuwe campagne toe als rij in de sheet, in de eerste lege rij na de
 * bestaande data — net als handmatig een rij onderaan invullen. Kolommen worden op
 * kolomkop gezocht (dezelfde aanpak als `schrijfVeld`), zodat de volgorde van kolommen
 * in de sheet er niet toe doet. Velden die niet zijn ingevuld blijven leeg; kolommen die
 * niet vanuit het dashboard te schrijven zijn (Leads, Order totaal, Status, …) blijven
 * ook leeg totdat iemand of iets anders ze vult.
 */
export async function voegCampagneToe(velden: NieuweCampagneVelden): Promise<void> {
  const naam = velden.naam.trim();
  if (!naam) {
    throw new Error("Campagnenaam is verplicht.");
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:Z`,
    });
    const rows = data.values ?? [];
    if (rows.length === 0) {
      throw new Error("Tabblad “Campagnes” lijkt leeg.");
    }

    const header = rows[0];
    const campagneKolomIndex = header.indexOf("Campagne naam");
    if (campagneKolomIndex === -1) {
      throw new Error('Kolom "Campagne naam" niet gevonden in de sheet.');
    }

    const bestaatAl = rows.some(
      (row, i) => i > 0 && row[campagneKolomIndex]?.trim().toLowerCase() === naam.toLowerCase(),
    );
    if (bestaatAl) {
      throw new Error(`Er bestaat al een campagne met de naam "${naam}".`);
    }

    const rij = new Array(header.length).fill("");
    rij[campagneKolomIndex] = naam;
    for (const [veld, kolomNaam] of Object.entries(SCHRIJFBARE_VELDEN)) {
      if (veld === "naam") continue;
      const waarde = velden[veld as keyof NieuweCampagneVelden];
      if (!waarde) continue;
      const kolomIndex = header.indexOf(kolomNaam);
      if (kolomIndex !== -1) rij[kolomIndex] = waarde;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:Z`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [rij] },
    });
  } catch (err) {
    throw vertaalAuthFout(err);
  }
}
