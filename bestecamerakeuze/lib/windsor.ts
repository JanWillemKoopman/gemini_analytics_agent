/**
 * Windsor.ai — de koppeling naar de social-mediakanalen.
 *
 * Windsor.ai zit tussen Meta en dit dashboard: de accounts zijn daar eenmalig
 * gekoppeld en Windsor levert de cijfers terug als één JSON-feed per connector. Voor
 * Facebook zijn dat er twee, en dat onderscheid is het belangrijkste wat je van deze
 * koppeling moet weten:
 *
 * - `facebook` — **betaald**: de advertentieaccounts (Meta Ads). Eén rij per dag per
 *   campagne, met uitgaven, weergaven, bereik, clicks en leads.
 * - `facebook_organic` — **onbetaald**: de Facebook-pagina's zelf. Rijen per dag per
 *   pagina (volgers, paginaweergaven) én per bericht (weergaven, reacties, clicks).
 *
 * Die twee nooit bij elkaar optellen: een betaalde weergave uit een advertentie en een
 * organische weergave van een bericht zijn niet dezelfde gebeurtenis, en de organische
 * feed rapporteert de paginacijfers toch al inclusief het betaalde deel. De pagina houdt
 * ze daarom in twee aparte blokken.
 *
 * De sleutel (`WINDSOR_API_KEY`) staat uitsluitend op de server: elke aanroep loopt via
 * `app/api/social/facebook/route.ts`, nooit vanuit de browser. Windsor zet de sleutel in
 * de query-string, dus foutmeldingen worden hieronder eerst geschoond voordat ze
 * doorgegeven worden — een 401 van Windsor echoot anders de hele URL terug in de UI.
 *
 * Meer velden toevoegen kan zonder de connector te wijzigen: zet de veld-id in
 * `ADVERTENTIE_VELDEN` of `ORGANISCHE_VELDEN` en neem hem mee in de aggregatie. De
 * geldige veld-id's staan in de Windsor-documentatie (of vraag ze op met de
 * Windsor-MCP-tool `get_fields`).
 */

const WINDSOR_BASIS = "https://connectors.windsor.ai";

/**
 * Betaald: één rij per dag per campagne. Bewust géén `ctr`, `cpc`, `cpm` of
 * `frequency` opvragen — dat zijn verhoudingsgetallen per rij, en die mag je niet
 * optellen of gemiddelden. Ze worden opnieuw berekend uit de opgetelde grondgetallen
 * (met `deel`), zodat het periodecijfer klopt in plaats van een gemiddelde van dagen.
 */
const ADVERTENTIE_VELDEN = [
  "date",
  "account_name",
  "campaign",
  "objective",
  "impressions",
  "reach",
  "clicks",
  "link_clicks",
  "spend",
  "actions_lead",
  "actions_post_engagement",
] as const;

/**
 * Onbetaald: paginacijfers en berichtcijfers komen door elkaar in één feed. Een rij
 * met een `post_id` is een bericht (met levenslange cijfers, op de dag dat het
 * geplaatst is); een rij zonder `post_id` is de dagstand van de pagina zelf. Op de
 * berichtrijen staan de paginavelden op 0 en omgekeerd, dus het `post_id` is de enige
 * splitsing die nodig is.
 *
 * Bewust niet opgevraagd: `post_video_views`. Meta vult dat veld voor inline video en
 * reels niet meer (een bericht met 34.000 weergaven meldt er 52), en een cijfer dat de
 * kolom ernaast tegenspreekt kost meer vertrouwen dan het oplevert. Wie videoprestaties
 * wil meten, heeft de reels-velden (`post_video_view_time`, `blue_reels_play_count`)
 * nodig — en dan eerst nagaan of die voor deze pagina's wél gevuld zijn.
 */
const ORGANISCHE_VELDEN = [
  "date",
  "account_name",
  "post_id",
  "post_created_time",
  "post_message_oneline",
  "permalink_url",
  "type",
  "post_impressions",
  "post_impressions_unique",
  "post_reactions_total",
  "post_comments_total",
  "post_clicks",
  "page_fans",
  "page_daily_follows",
  "page_impressions",
  "page_impressions_organic",
  "page_post_engagements",
] as const;

type WindsorRij = Record<string, unknown>;

/** Haalt de sleutel uit een foutmelding; Windsor echoot de query-string terug bij een 401. */
function schoon(tekst: string, sleutel: string): string {
  return sleutel ? tekst.split(sleutel).join("…") : tekst;
}

async function haalConnector(
  connector: string,
  velden: readonly string[],
  van: string,
  tot: string,
): Promise<WindsorRij[]> {
  const sleutel = process.env.WINDSOR_API_KEY;
  if (!sleutel) {
    throw new Error("WINDSOR_API_KEY ontbreekt — zie .env.example.");
  }

  const url = new URL(`${WINDSOR_BASIS}/${connector}`);
  url.searchParams.set("date_from", van);
  url.searchParams.set("date_to", tot);
  url.searchParams.set("fields", velden.join(","));
  url.searchParams.set("api_key", sleutel);

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(55_000) });
  } catch (err) {
    const melding = err instanceof Error ? err.message : String(err);
    throw new Error(`Windsor.ai (${connector}) reageerde niet: ${schoon(melding, sleutel)}`);
  }

  if (!res.ok) {
    const body = schoon((await res.text().catch(() => "")).slice(0, 300), sleutel);
    throw new Error(`Windsor.ai (${connector}) gaf status ${res.status}${body ? `: ${body}` : ""}`);
  }

  const json: unknown = await res.json();
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) {
    const fout = (json as { error?: unknown })?.error;
    throw new Error(
      `Windsor.ai (${connector}) gaf geen rijen terug${
        typeof fout === "string" ? `: ${schoon(fout, sleutel)}` : ""
      }`,
    );
  }
  return data as WindsorRij[];
}

/** Windsor levert getallen als number, maar lege cellen als null — en soms als string. */
function getal(waarde: unknown): number {
  if (typeof waarde === "number") return Number.isFinite(waarde) ? waarde : 0;
  if (typeof waarde === "string") {
    const n = Number(waarde);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function tekst(waarde: unknown): string {
  return typeof waarde === "string" && waarde.trim() !== "" ? waarde : "";
}

/**
 * Dezelfde vestiging heet in het advertentieaccount anders dan op de Facebook-pagina:
 * Meta kent "Veloo" én "VELOO", "Porsche centrum Maastricht" én "Porsche Centrum
 * Maastricht". Zonder normalisatie staan die als twee losse regels in het accountfilter
 * en zie je bij de een alleen de advertenties en bij de ander alleen de pagina.
 *
 * Groeperen gaat daarom op de naam zonder hoofdletters en zonder dubbele spaties. Welke
 * schrijfwijze vervolgens in beeld komt, is een keuze: de variant die het meest op
 * normale naamgeving lijkt. Elk woord met een hoofdletter aan het begin telt mee, een
 * woord in volledige kapitalen gaat er weer af — zo wint "Veloo" van "VELOO" en
 * "Porsche Centrum Maastricht" van "Porsche centrum Maastricht". Bij een gelijke stand
 * beslist de alfabetische volgorde, zodat de uitkomst niet afhangt van de rijvolgorde
 * die Windsor toevallig teruggeeft.
 */
function normaliseerNaam(naam: string): string {
  return naam.trim().replace(/\s+/g, " ").toLowerCase();
}

function naamScore(naam: string): number {
  const woorden = naam.trim().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const woord of woorden) {
    if (woord[0] === woord[0]?.toUpperCase() && woord[0] !== woord[0]?.toLowerCase()) score += 2;
    if (woord.length > 1 && woord === woord.toUpperCase() && woord !== woord.toLowerCase()) {
      score -= 1;
    }
  }
  return score;
}

/** Normaliseerde naam → de schrijfwijze die de UI gebruikt. */
export function canoniekeAccountnamen(ruweNamen: Iterable<string>): Map<string, string> {
  const perSleutel = new Map<string, string[]>();
  for (const ruw of ruweNamen) {
    const sleutel = normaliseerNaam(ruw);
    if (!sleutel) continue;
    const varianten = perSleutel.get(sleutel);
    if (varianten) {
      if (!varianten.includes(ruw)) varianten.push(ruw);
    } else {
      perSleutel.set(sleutel, [ruw]);
    }
  }

  const gekozen = new Map<string, string>();
  for (const [sleutel, varianten] of perSleutel) {
    const beste = [...varianten].sort(
      (a, b) => naamScore(b) - naamScore(a) || a.localeCompare(b, "nl"),
    )[0];
    gekozen.set(sleutel, beste);
  }
  return gekozen;
}

/** Verhoudingsgetal dat `null` blijft zodra de noemer ontbreekt, i.p.v. NaN of ∞. */
export function deel(teller: number, noemer: number): number | null {
  if (!Number.isFinite(teller) || !Number.isFinite(noemer) || noemer === 0) return null;
  return teller / noemer;
}

/** De zeven grondgetallen van het betaalde deel; alles daarbuiten is hieruit afgeleid. */
export interface AdvertentieMetingen {
  uitgaven: number;
  weergaven: number;
  /**
   * Som van het dagbereik. Meta rapporteert bereik per dag als "unieke personen", dus
   * wie op meer dagen bereikt is, telt hier meer dan één keer. Een periodebereik is
   * niet uit dagcijfers te herleiden — de UI zet die kanttekening erbij in plaats van
   * het getal te verzwijgen of als uniek te presenteren.
   */
  bereik: number;
  clicks: number;
  websiteClicks: number;
  leads: number;
  interacties: number;
}

/** Eén dag van één advertentieaccount — de kleinste eenheid die de pagina meekrijgt. */
export interface AdvertentieDagAccount extends AdvertentieMetingen {
  datum: string;
  account: string;
}

export interface AdvertentieCampagne extends AdvertentieMetingen {
  account: string;
  campagne: string;
  doel: string;
}

export interface OrganischePagina {
  account: string;
  /** Laatst bekende stand in de periode; volgers zijn een voorraad, geen dagsom. */
  volgers: number | null;
  volgersErbij: number;
  weergaven: number;
  organischeWeergaven: number;
  interacties: number;
  berichten: number;
}

export interface OrganischBericht {
  postId: string;
  account: string;
  datum: string;
  bericht: string;
  url: string;
  soort: string;
  weergaven: number;
  bereik: number;
  reacties: number;
  opmerkingen: number;
  clicks: number;
}

export interface FacebookOverzicht {
  van: string;
  tot: string;
  /** Alle dagen in de periode, ook de stille — zodat de grafiek geen gaten heeft. */
  dagen: string[];
  betaald: {
    perDagPerAccount: AdvertentieDagAccount[];
    campagnes: AdvertentieCampagne[];
  };
  organisch: {
    paginas: OrganischePagina[];
    berichten: OrganischBericht[];
  };
  /** Alle accountnamen uit beide connectors, voor het accountfilter. */
  accounts: string[];
  /** Wat er niet opgehaald kon worden; de rest van de pagina werkt dan gewoon door. */
  waarschuwingen: string[];
}

export function leegMetingen(): AdvertentieMetingen {
  return {
    uitgaven: 0,
    weergaven: 0,
    bereik: 0,
    clicks: 0,
    websiteClicks: 0,
    leads: 0,
    interacties: 0,
  };
}

/**
 * Telt metingen bij elkaar op. Eén implementatie, gebruikt door de server (dag- en
 * campagnetotalen) én door de pagina zelf (de totalen na het accountfilter) — zodat het
 * filteren in de browser nooit een ander getal oplevert dan de server zou geven.
 */
export function telMetingen(rijen: readonly AdvertentieMetingen[]): AdvertentieMetingen {
  const som = leegMetingen();
  for (const r of rijen) {
    som.uitgaven += r.uitgaven;
    som.weergaven += r.weergaven;
    som.bereik += r.bereik;
    som.clicks += r.clicks;
    som.websiteClicks += r.websiteClicks;
    som.leads += r.leads;
    som.interacties += r.interacties;
  }
  return som;
}

/** Alle dagen tussen twee ISO-datums, zodat een stille dag als nul in de grafiek staat. */
export function dagenTussen(van: string, tot: string): string[] {
  const dagen: string[] = [];
  const eind = new Date(`${tot}T00:00:00Z`);
  for (const d = new Date(`${van}T00:00:00Z`); d <= eind; d.setUTCDate(d.getUTCDate() + 1)) {
    dagen.push(d.toISOString().slice(0, 10));
  }
  return dagen;
}

/**
 * Rijen uit de `facebook`-connector (één per dag per campagne) naar twee vormen: per
 * dag per account (voor de grafiek en de totalen) en per campagne (voor de tabel).
 *
 * Verder wordt er niets voorgeaggregeerd: het accountfilter op de pagina moet elk
 * totaal opnieuw kunnen uitrekenen zonder de server er weer voor aan te roepen.
 */
export function verwerkAdvertenties(
  rijen: WindsorRij[],
  naamVoor: (ruw: string) => string = (ruw) => ruw,
): FacebookOverzicht["betaald"] {
  const perDag = new Map<string, AdvertentieDagAccount>();
  const campagnes = new Map<string, AdvertentieCampagne>();

  for (const rij of rijen) {
    const datum = tekst(rij.date).slice(0, 10);
    const account = naamVoor(tekst(rij.account_name)) || "Onbekend account";
    const campagne = tekst(rij.campaign) || "Zonder campagnenaam";
    const meting: AdvertentieMetingen = {
      uitgaven: getal(rij.spend),
      weergaven: getal(rij.impressions),
      bereik: getal(rij.reach),
      clicks: getal(rij.clicks),
      websiteClicks: getal(rij.link_clicks),
      leads: getal(rij.actions_lead),
      interacties: getal(rij.actions_post_engagement),
    };

    const dagSleutel = JSON.stringify([datum, account]);
    const dag = perDag.get(dagSleutel);
    if (dag) {
      Object.assign(dag, telMetingen([dag, meting]));
    } else {
      perDag.set(dagSleutel, { datum, account, ...meting });
    }

    const campagneSleutel = JSON.stringify([account, campagne]);
    const bestaand = campagnes.get(campagneSleutel);
    if (bestaand) {
      Object.assign(bestaand, telMetingen([bestaand, meting]));
    } else {
      campagnes.set(campagneSleutel, {
        account,
        campagne,
        doel: tekst(rij.objective),
        ...meting,
      });
    }
  }

  return {
    perDagPerAccount: [...perDag.values()],
    campagnes: [...campagnes.values()].sort((a, b) => b.uitgaven - a.uitgaven),
  };
}

/**
 * Rijen uit de `facebook_organic`-connector naar pagina's en berichten.
 *
 * Twee dingen die makkelijk fout gaan en hier bewust afgehandeld worden:
 * - **Berichten en pagina's staan in dezelfde feed.** Een `post_id` maakt er een
 *   bericht van; de paginavelden staan op zulke rijen op 0, dus zonder deze splitsing
 *   zou elk paginacijfer op een dag met berichten te laag uitvallen.
 * - **Volgers zijn een voorraad, geen dagsom.** Optellen geeft een getal van
 *   honderdduizenden; daarom de laatst bekende stand in de periode. Wat er in de
 *   periode bijkwam staat apart als `volgersErbij` (dát is wel een dagsom).
 */
export function verwerkOrganisch(
  rijen: WindsorRij[],
  naamVoor: (ruw: string) => string = (ruw) => ruw,
): FacebookOverzicht["organisch"] {
  const paginas = new Map<string, OrganischePagina & { laatsteDatum: string }>();
  const berichten = new Map<string, OrganischBericht>();

  for (const rij of rijen) {
    const account = naamVoor(tekst(rij.account_name)) || "Onbekende pagina";
    const datum = tekst(rij.date).slice(0, 10);
    const postId = tekst(rij.post_id);

    let pagina = paginas.get(account);
    if (!pagina) {
      pagina = {
        account,
        volgers: null,
        volgersErbij: 0,
        weergaven: 0,
        organischeWeergaven: 0,
        interacties: 0,
        berichten: 0,
        laatsteDatum: "",
      };
      paginas.set(account, pagina);
    }

    if (postId) {
      // Eén rij per bericht, maar dedupliceer op id: als Windsor een bericht op twee
      // dagen meegeeft, is het nog steeds hetzelfde bericht met levenslange cijfers.
      if (!berichten.has(postId)) {
        pagina.berichten += 1;
        berichten.set(postId, {
          postId,
          account,
          datum: tekst(rij.post_created_time).slice(0, 10) || datum,
          bericht: tekst(rij.post_message_oneline),
          url: tekst(rij.permalink_url),
          soort: tekst(rij.type),
          weergaven: getal(rij.post_impressions),
          bereik: getal(rij.post_impressions_unique),
          reacties: getal(rij.post_reactions_total),
          opmerkingen: getal(rij.post_comments_total),
          clicks: getal(rij.post_clicks),
        });
      }
      continue;
    }

    pagina.volgersErbij += getal(rij.page_daily_follows);
    pagina.weergaven += getal(rij.page_impressions);
    pagina.organischeWeergaven += getal(rij.page_impressions_organic);
    pagina.interacties += getal(rij.page_post_engagements);

    const volgers = getal(rij.page_fans);
    if (volgers > 0 && datum >= pagina.laatsteDatum) {
      pagina.volgers = volgers;
      pagina.laatsteDatum = datum;
    }
  }

  return {
    paginas: [...paginas.values()]
      .map(({ laatsteDatum: _laatsteDatum, ...pagina }) => pagina)
      .sort((a, b) => (b.volgers ?? 0) - (a.volgers ?? 0)),
    berichten: [...berichten.values()].sort((a, b) => b.weergaven - a.weergaven),
  };
}

/**
 * Het hele Facebook-overzicht voor één periode.
 *
 * De twee connectors worden parallel opgehaald; valt de organische feed weg (een pagina
 * met een verlopen token bijvoorbeeld), dan blijft het betaalde deel gewoon staan, met
 * een waarschuwing erboven. Het omgekeerde geldt ook. Alleen als beide wegvallen gooit
 * deze functie de fout door — dan is er niets te tonen.
 */
export async function haalFacebookOverzicht(
  van: string,
  tot: string,
): Promise<FacebookOverzicht> {
  const [adsResultaat, organischResultaat] = await Promise.allSettled([
    haalConnector("facebook", ADVERTENTIE_VELDEN, van, tot),
    haalConnector("facebook_organic", ORGANISCHE_VELDEN, van, tot),
  ]);

  if (adsResultaat.status === "rejected" && organischResultaat.status === "rejected") {
    throw adsResultaat.reason;
  }

  const waarschuwingen: string[] = [];
  if (adsResultaat.status === "rejected") {
    waarschuwingen.push(
      `De advertentiecijfers konden niet worden opgehaald — hieronder staat alleen het organische deel. ${
        adsResultaat.reason instanceof Error ? adsResultaat.reason.message : ""
      }`.trim(),
    );
  }
  if (organischResultaat.status === "rejected") {
    waarschuwingen.push(
      `De cijfers van de pagina's zelf konden niet worden opgehaald — hieronder staan alleen de advertenties. ${
        organischResultaat.reason instanceof Error ? organischResultaat.reason.message : ""
      }`.trim(),
    );
  }

  const adsRijen = adsResultaat.status === "fulfilled" ? adsResultaat.value : [];
  const organischRijen = organischResultaat.status === "fulfilled" ? organischResultaat.value : [];

  // Eerst de namen uit béide feeds samen normaliseren, dan aggregeren: het
  // advertentieaccount en de pagina van dezelfde vestiging moeten onder één naam
  // vallen, anders staan ze als twee losse regels in het accountfilter.
  const namen = canoniekeAccountnamen(
    [...adsRijen, ...organischRijen]
      .map((rij) => tekst(rij.account_name))
      .filter((naam) => naam !== ""),
  );
  const naamVoor = (ruw: string) => namen.get(normaliseerNaam(ruw)) ?? ruw;

  const betaald = verwerkAdvertenties(adsRijen, naamVoor);
  const organisch = verwerkOrganisch(organischRijen, naamVoor);

  const accounts = [
    ...new Set([
      ...betaald.perDagPerAccount.map((d) => d.account),
      ...organisch.paginas.map((p) => p.account),
    ]),
  ].sort((a, b) => a.localeCompare(b, "nl"));

  return {
    van,
    tot,
    dagen: dagenTussen(van, tot),
    betaald,
    organisch,
    accounts,
    waarschuwingen,
  };
}
