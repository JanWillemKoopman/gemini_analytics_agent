/**
 * De verbinding met Windsor.ai.
 *
 * Windsor bundelt zes advertentie- en socialconnectoren achter één REST-endpoint. Dit
 * bestand is de enige plek die dat endpoint kent; de rest van de app praat met Postgres.
 *
 * Drie dingen die uit het onderzoek kwamen en die hier zijn vastgelegd:
 *
 *  1. **Per connector ophalen, niet via `/all`.** Het gecombineerde endpoint is
 *     alles-of-niets: één connector die een fout geeft (bijvoorbeeld Meta dat weigert
 *     verder dan 37 maanden terug te kijken) laat de hele request met een 400 sneuvelen.
 *     Per connector blijft een storing bij één platform beperkt tot dat platform.
 *
 *  2. **Accounts zónder prefix.** Op `/all` heten de accounts `facebook__69324444`, op
 *     `/facebook` heten ze gewoon `69324444`. Verwarrend, en de foutmelding helpt niet.
 *
 *  3. **Ruim de tijd nemen.** Facebook organic deed er in de meting 131 seconden over
 *     een kwartaal aan posts. Dat is prima voor een nachtelijke job en onmogelijk voor
 *     een webrequest — vandaar dat niets in de app dit bestand tijdens een paginaweergave
 *     aanroept.
 */

const BASIS = "https://connectors.windsor.ai";

/** Ruim boven de traagste gemeten opvraging (131 s), met marge voor een drukke nacht. */
const TIMEOUT_MS = 280_000;
const POGINGEN = 3;

export type Connector =
  | "facebook"
  | "facebook_organic"
  | "instagram"
  | "linkedin"
  | "linkedin_organic"
  | "google_ads";

/**
 * De accounts per connector.
 *
 * Staan in de code en niet in de database omdat ze bij de koppeling horen, niet bij de
 * data: een account toevoegen betekent eerst iets aanzetten in Windsor zelf. Wel te
 * overschrijven via een omgevingsvariabele (`WINDSOR_ACCOUNTS_FACEBOOK=…`), zodat een
 * nieuw account niet op een deploy hoeft te wachten.
 */
const STANDAARD_ACCOUNTS: Record<Connector, string[]> = {
  facebook: [
    "1662865740824278", // Veloo
    "192180818785600", // Bentley Maastricht
    "293327521823561", // Porsche Groep Zuid
    "315013592825616", // Porsche centrum Maastricht
    "69324444", // Van den Udenhout
    "744220736319839",
  ],
  facebook_organic: [
    "113133791655546", // VELOO
    "135654409827841", // Van den Udenhout
    "152454588113374", // Porsche Centrum Brabant
    "1856659467764845", // Porsche Centrum Maastricht
    "274218899266126", // Instra
    "324389797988583", // Audi Sport Eindhoven
  ],
  instagram: [
    "17841400383959539", // udenhoutgroep
    "17841400735388282", // porschebrabant
    "17841409820778415", // porschecentrummaastricht
    "17841457360463399", // veloonl
  ],
  linkedin: ["500669928", "515419437", "515420450", "515420451", "515422432"],
  linkedin_organic: [
    "1688996", // Porsche Centrum Brabant
    "288254", // Van den Udenhout Groep
    "77458602", // Porsche Centrum Maastricht
    "91687065", // VELOO
  ],
  google_ads: ["210-769-6929"], // Udenhout
};

const ENV_SLEUTEL: Record<Connector, string> = {
  facebook: "WINDSOR_ACCOUNTS_FACEBOOK",
  facebook_organic: "WINDSOR_ACCOUNTS_FACEBOOK_ORGANIC",
  instagram: "WINDSOR_ACCOUNTS_INSTAGRAM",
  linkedin: "WINDSOR_ACCOUNTS_LINKEDIN",
  linkedin_organic: "WINDSOR_ACCOUNTS_LINKEDIN_ORGANIC",
  google_ads: "WINDSOR_ACCOUNTS_GOOGLE_ADS",
};

export function accountsVoor(connector: Connector): string[] {
  const uitEnv = process.env[ENV_SLEUTEL[connector]];
  if (uitEnv && uitEnv.trim()) {
    return uitEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return STANDAARD_ACCOUNTS[connector];
}

export function isWindsorGeconfigureerd(): boolean {
  return Boolean(process.env.WINDSOR_API_KEY);
}

/** Eén rij zoals Windsor hem teruggeeft: veldnaam → waarde, met veel nulls. */
export type WindsorRij = Record<string, string | number | boolean | null>;

interface Foutantwoord {
  error?: string;
  code?: string;
}

function isFoutantwoord(waarde: unknown): waarde is Foutantwoord {
  return typeof waarde === "object" && waarde !== null && "error" in waarde;
}

async function wacht(ms: number): Promise<void> {
  await new Promise((klaar) => setTimeout(klaar, ms));
}

/**
 * Haalt één connector op over één periode.
 *
 * Herprobeert bij netwerkfouten en 5xx, maar **niet** bij een 400: dat is Windsor die
 * zegt dat de vraag zelf niet klopt (een onbekend veld, een verboden veldcombinatie, een
 * datum buiten het venster). Nog eens proberen levert dan precies dezelfde fout op en
 * kost alleen tijd.
 */
export async function haalOp(
  connector: Connector,
  velden: string[],
  van: string,
  tot: string,
): Promise<WindsorRij[]> {
  const sleutel = process.env.WINDSOR_API_KEY;
  if (!sleutel) throw new Error("WINDSOR_API_KEY ontbreekt.");

  const accounts = accountsVoor(connector);
  if (accounts.length === 0) return [];

  const query = new URLSearchParams({
    date_from: van,
    date_to: tot,
    fields: velden.join(","),
    select_accounts: accounts.join(","),
    api_key: sleutel,
  });

  let laatsteFout: Error | null = null;

  for (let poging = 1; poging <= POGINGEN; poging++) {
    const afbreken = AbortSignal.timeout(TIMEOUT_MS);
    try {
      const res = await fetch(`${BASIS}/${connector}?${query}`, {
        signal: afbreken,
        cache: "no-store",
      });

      const tekst = await res.text();
      let geparsed: unknown;
      try {
        geparsed = JSON.parse(tekst);
      } catch {
        throw new Error(`${connector}: antwoord was geen JSON (status ${res.status})`);
      }

      if (isFoutantwoord(geparsed)) {
        // Een inhoudelijke fout: niet opnieuw proberen, wel duidelijk doorgeven.
        throw Object.assign(new Error(`${connector}: ${geparsed.error}`), {
          definitief: true,
        });
      }

      if (!res.ok) throw new Error(`${connector}: status ${res.status}`);

      const data = (geparsed as { data?: WindsorRij[] }).data ?? (geparsed as WindsorRij[]);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      const fout = err instanceof Error ? err : new Error(String(err));
      if ((fout as { definitief?: boolean }).definitief) throw fout;
      laatsteFout = fout;
      if (poging < POGINGEN) await wacht(2000 * 2 ** (poging - 1));
    }
  }

  throw laatsteFout ?? new Error(`${connector}: ophalen mislukt`);
}

/**
 * De veldcatalogus van het hele account: 4.393 velden met per veld in welke connectoren
 * hij bestaat. De sync gebruikt hem om de maatwerkconversies te ontdekken — die heten
 * per account anders (`actions_proefrit_aanvraag`, `conversions_ud_macro_inruilvoorstel`)
 * en komen erbij zodra marketing een nieuwe conversie-actie aanzet.
 */
export interface VeldDefinitie {
  id: string;
  name: string;
  description?: string;
  type: string;
  available_in_connectors?: string[];
}

export async function haalVeldcatalogus(): Promise<VeldDefinitie[]> {
  const sleutel = process.env.WINDSOR_API_KEY;
  if (!sleutel) throw new Error("WINDSOR_API_KEY ontbreekt.");

  const res = await fetch(`${BASIS}/all/fields?api_key=${sleutel}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`veldcatalogus: status ${res.status}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("veldcatalogus: onverwacht antwoord");
  return data as VeldDefinitie[];
}

/** Windsor levert getallen soms als string; alles wat geen getal is wordt 0. */
export function getal(waarde: unknown): number {
  if (typeof waarde === "number") return Number.isFinite(waarde) ? waarde : 0;
  if (typeof waarde === "string" && waarde.trim() !== "") {
    const n = Number(waarde);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Lege strings tellen als afwezig — Windsor gebruikt ze door elkaar met null. */
export function tekst(waarde: unknown): string | null {
  if (typeof waarde === "string") return waarde.trim() === "" ? null : waarde;
  if (typeof waarde === "number") return String(waarde);
  return null;
}
