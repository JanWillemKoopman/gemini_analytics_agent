/**
 * De kubus: het datafomaat waarin een Kanalen-pagina zijn cijfers binnenkrijgt, en de
 * rekenregels die erop werken.
 *
 * ## Waarom rijen als arrays en niet als objecten
 *
 * Een pagina haalt bij het openen één keer alles op voor de gekozen periode en filtert
 * daarna in het geheugen. Dat kan alleen als die ene ophaalactie klein blijft. Gemeten
 * op 5.700 rijen met veertien statistieken:
 *
 *   array van objecten   1.604 KB rauw → 338 KB gzip
 *   rijen als arrays       498 KB rauw → 222 KB gzip
 *
 * Het verschil zit in twee dingen: de veldnamen worden niet per rij herhaald, en
 * terugkerende tekst (accountnamen, campagnenamen) staat één keer in `labels` met in de
 * rij alleen de index. Vandaar dit formaat — het is geen voortijdige optimalisatie maar
 * het verschil tussen wel en niet in het geheugen kunnen filteren.
 *
 * ## De valkuil die hier wordt afgevangen
 *
 * Een afgeleide statistiek (CTR, kosten per klik, kosten per lead) mag nooit worden
 * opgeteld of gemiddeld. Het gemiddelde van tien CTR's is niet de CTR van die tien
 * advertenties samen: een advertentie met tien vertoningen telt dan even zwaar als een
 * met tienduizend. Elke afgeleide draagt daarom zijn teller en noemer bij zich, en wordt
 * hier altijd ná het optellen berekend. Zie `lib/windsor/velden.ts`.
 */

import type { Statistiek } from "@/lib/windsor/velden";

export type Korrel = "dag" | "week" | "maand" | "kwartaal";

export interface Kubus {
  /** Namen van de dimensiekolommen, in de volgorde waarin ze vooraan elke rij staan. */
  dimensies: string[];
  /** Per dimensie de mogelijke waarden; een rij bevat de index in deze lijst. */
  labels: Record<string, string[]>;
  /** Namen van de optelbare statistieken, in de volgorde waarin ze achteraan staan. */
  kolommen: string[];
  /** Dimensie-indexen gevolgd door de meetwaarden. */
  rijen: number[][];
  /** Op welke korrel de server de data al heeft samengevat. */
  korrel: "dag" | "week";
  periode: { van: string; tot: string };
  /**
   * Kolommen die een **stand** meten in plaats van een **stroom**.
   *
   * Uitgaven, klikken en nieuwe volgers zijn stromen: een dag levert er een hoeveelheid
   * van op, en twee dagen samen leveren de som op. Het aantal volgers is een stand: het
   * is er gewoon, elke dag opnieuw. Wie die optelt over dertig dagen krijgt dertig keer
   * zijn eigen publiek — in de eerste versie van deze pagina stond daardoor 2,3 miljoen
   * volgers voor een dealergroep met er ongeveer tachtigduizend.
   *
   * Een stand wordt daarom per entiteit (zie `standPer`) op zijn laatst bekende waarde
   * gezet, en pas dáárna over entiteiten opgeteld.
   */
  standKolommen?: string[];
  /** De dimensie waarvan een stand geldt — meestal "account". */
  standPer?: string;
  /**
   * Losse tekst die bij een dimensiewaarde hoort maar niet filterbaar is: de thumbnail
   * van een advertentie, de permalink van een post. Bewust hierbuiten gehouden in plaats
   * van als extra dimensie: het zijn geen waarden om op te filteren of te groeperen, en
   * als dimensie zouden ze de rijen onnodig opsplitsen.
   */
  meta?: Record<string, Record<string, string | null>>;
}

export const LEGE_KUBUS: Kubus = {
  dimensies: [],
  labels: {},
  kolommen: [],
  rijen: [],
  korrel: "dag",
  periode: { van: "", tot: "" },
};

/** De gekozen waarden per dimensie; een lege lijst betekent "alle". */
export type Selectie = Record<string, string[]>;

// ---------------------------------------------------------------------------
// Periodes
// ---------------------------------------------------------------------------

/**
 * De ISO-weeknummering (maandag als eerste dag, week 1 bevat de eerste donderdag).
 *
 * Bewust ISO en niet de Amerikaanse variant die Windsor óók aanbiedt: het weekoverleg
 * loopt van maandag tot maandag, en een week die op zondag begint sluit daar niet op aan.
 */
export function isoWeek(datum: string): { jaar: number; week: number } {
  const d = new Date(`${datum}T00:00:00Z`);
  // Naar de donderdag van deze week: die bepaalt in welk jaar de week valt.
  const dagVanWeek = (d.getUTCDay() + 6) % 7; // maandag = 0
  d.setUTCDate(d.getUTCDate() - dagVanWeek + 3);
  const jaar = d.getUTCFullYear();
  const eersteDonderdag = new Date(Date.UTC(jaar, 0, 4));
  const offset = (eersteDonderdag.getUTCDay() + 6) % 7;
  eersteDonderdag.setUTCDate(eersteDonderdag.getUTCDate() - offset + 3);
  const week = 1 + Math.round((d.getTime() - eersteDonderdag.getTime()) / (7 * 86400000));
  return { jaar, week };
}

/**
 * Zet een datum om naar de sleutel van zijn periode. De sleutel sorteert alfabetisch in
 * chronologische volgorde — daar leunt de grafiek op, dus houd dat zo bij een wijziging.
 */
export function periodeSleutel(datum: string, korrel: Korrel): string {
  if (korrel === "dag") return datum;
  if (korrel === "maand") return datum.slice(0, 7);
  if (korrel === "kwartaal") {
    const maand = Number(datum.slice(5, 7));
    return `${datum.slice(0, 4)}-K${Math.floor((maand - 1) / 3) + 1}`;
  }
  const { jaar, week } = isoWeek(datum);
  return `${jaar}-W${String(week).padStart(2, "0")}`;
}

/** Hoe een periode in de grafiek en de tabel heet. */
export function periodeLabel(sleutel: string, korrel: Korrel): string {
  if (korrel === "dag") {
    const [j, m, d] = sleutel.split("-");
    return `${Number(d)} ${MAANDEN_KORT[Number(m) - 1]}${j !== String(new Date().getFullYear()) ? ` ${j}` : ""}`;
  }
  if (korrel === "week") {
    const [jaar, week] = sleutel.split("-W");
    return `wk ${Number(week)} ${jaar}`;
  }
  if (korrel === "maand") {
    const [jaar, maand] = sleutel.split("-");
    return `${MAANDEN_KORT[Number(maand) - 1]} ${jaar}`;
  }
  const [jaar, kwartaal] = sleutel.split("-K");
  return `Q${kwartaal} ${jaar}`;
}

const MAANDEN_KORT = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

// ---------------------------------------------------------------------------
// Filteren
// ---------------------------------------------------------------------------

/**
 * Filtert de rijen op de selectie.
 *
 * De selectie staat in labels (leesbaar, en stabiel als de kubus opnieuw wordt
 * opgehaald), maar de rijen dragen indexen. Die vertaling gebeurt één keer vooraf in een
 * `Set<number>` per dimensie, zodat de eigenlijke filterlus alleen nog integers
 * vergelijkt — dat is wat het filteren onder de milliseconde houdt.
 */
export function filter(kubus: Kubus, selectie: Selectie): number[][] {
  const tests: { kolom: number; toegestaan: Set<number> }[] = [];

  kubus.dimensies.forEach((dim, i) => {
    const gekozen = selectie[dim];
    if (!gekozen || gekozen.length === 0) return;
    const labels = kubus.labels[dim] ?? [];
    const toegestaan = new Set<number>();
    gekozen.forEach((waarde) => {
      const index = labels.indexOf(waarde);
      if (index !== -1) toegestaan.add(index);
    });
    // Een filter op een waarde die niet (meer) bestaat, moet niets opleveren in plaats
    // van stilletjes alles door te laten — anders lijkt een verkeerd filter te werken.
    tests.push({ kolom: i, toegestaan });
  });

  if (tests.length === 0) return kubus.rijen;
  return kubus.rijen.filter((rij) => tests.every((t) => t.toegestaan.has(rij[t.kolom])));
}

/** Welke waarden komen in de (gefilterde) rijen nog voor? Voedt de filterdropdowns. */
export function beschikbareWaarden(kubus: Kubus, rijen: number[][], dimensie: string): string[] {
  const kolom = kubus.dimensies.indexOf(dimensie);
  if (kolom === -1) return [];
  const labels = kubus.labels[dimensie] ?? [];
  const gezien = new Set<number>();
  for (const rij of rijen) gezien.add(rij[kolom]);
  return [...gezien]
    .map((i) => labels[i])
    .filter((v): v is string => Boolean(v))
    .sort((a, b) => a.localeCompare(b, "nl"));
}

// ---------------------------------------------------------------------------
// Optellen
// ---------------------------------------------------------------------------

/**
 * Telt alle meetwaarden van een verzameling rijen bij elkaar op.
 *
 * Stromen worden opgeteld; standen (zie `standKolommen`) krijgen per entiteit hun
 * laatst bekende waarde en worden pas daarna over entiteiten opgeteld.
 */
export function telOp(kubus: Kubus, rijen: number[][]): Record<string, number> {
  const start = kubus.dimensies.length;
  const uit: Record<string, number> = {};
  kubus.kolommen.forEach((k) => (uit[k] = 0));

  const standen = standIndexen(kubus);
  for (const rij of rijen) {
    for (let i = 0; i < kubus.kolommen.length; i++) {
      if (standen.kolommen.has(i)) continue;
      uit[kubus.kolommen[i]] += rij[start + i] ?? 0;
    }
  }

  for (const [i, waarde] of laatsteStanden(kubus, rijen, standen)) {
    uit[kubus.kolommen[i]] = waarde;
  }
  return uit;
}

interface StandInfo {
  kolommen: Set<number>;
  entiteitKolom: number;
  datumKolom: number;
}

function standIndexen(kubus: Kubus): StandInfo {
  const kolommen = new Set<number>();
  for (const naam of kubus.standKolommen ?? []) {
    const i = kubus.kolommen.indexOf(naam);
    if (i !== -1) kolommen.add(i);
  }
  return {
    kolommen,
    entiteitKolom: kubus.dimensies.indexOf(kubus.standPer ?? "account"),
    datumKolom: kubus.dimensies.indexOf("datum"),
  };
}

/**
 * Per standkolom: de som over entiteiten van hun laatst bekende waarde.
 *
 * "Laatst bekend" is de hoogste datumindex waarop die entiteit een waarde groter dan nul
 * had. Bewust niet simpelweg de laatste rij: een account dat op de slotdag geen meting
 * had, zou dan op nul uitkomen en het groepstotaal laten kelderen.
 */
function laatsteStanden(
  kubus: Kubus,
  rijen: number[][],
  info: StandInfo,
): [number, number][] {
  if (info.kolommen.size === 0) return [];
  const start = kubus.dimensies.length;
  const uit: [number, number][] = [];

  for (const kolom of info.kolommen) {
    const perEntiteit = new Map<number, { datum: number; waarde: number }>();
    for (const rij of rijen) {
      const waarde = rij[start + kolom] ?? 0;
      if (!waarde) continue;
      const entiteit = info.entiteitKolom === -1 ? 0 : rij[info.entiteitKolom];
      const datum = info.datumKolom === -1 ? 0 : rij[info.datumKolom];
      const huidig = perEntiteit.get(entiteit);
      if (!huidig || datum >= huidig.datum) perEntiteit.set(entiteit, { datum, waarde });
    }
    let som = 0;
    for (const { waarde } of perEntiteit.values()) som += waarde;
    uit.push([kolom, som]);
  }
  return uit;
}

/**
 * Berekent één statistiek uit een opgetelde rij.
 *
 * Een optelbare statistiek staat er gewoon in; een afgeleide wordt hier pas gedeeld.
 * Delen door nul levert `null` op en geen Infinity of NaN: "geen klikken, dus geen prijs
 * per klik" is een lege cel, geen ∞.
 */
export function waardeVan(
  statistiek: Statistiek,
  totalen: Record<string, number>,
): number | null {
  if (!statistiek.afgeleid) {
    const waarde = totalen[statistiek.id];
    return waarde === undefined ? null : waarde;
  }
  const { teller, noemer, maal = 1 } = statistiek.afgeleid;
  const boven = totalen[teller] ?? 0;
  const onder = totalen[noemer] ?? 0;
  if (!onder) return null;
  return (boven / onder) * maal;
}

// ---------------------------------------------------------------------------
// Groeperen
// ---------------------------------------------------------------------------

export interface Groep {
  sleutel: string;
  label: string;
  totalen: Record<string, number>;
  aantalRijen: number;
}

/**
 * Groepeert rijen op een dimensie en telt per groep op.
 *
 * Gebruikt door de tabellen (groepeer op campagne, op advertentie, op account) en door
 * de grafiek (groepeer op periode). Eén functie, want het is dezelfde bewerking.
 */
export function groepeer(
  kubus: Kubus,
  rijen: number[][],
  dimensie: string,
): Groep[] {
  const kolom = kubus.dimensies.indexOf(dimensie);
  if (kolom === -1) return [];
  const labels = kubus.labels[dimensie] ?? [];
  const start = kubus.dimensies.length;

  const perGroep = new Map<number, number[][]>();
  for (const rij of rijen) {
    const sleutel = rij[kolom];
    const bestaand = perGroep.get(sleutel);
    if (bestaand) bestaand.push(rij);
    else perGroep.set(sleutel, [rij]);
  }
  void start;

  return [...perGroep.entries()].map(([index, groepRijen]) => {
    const naam = labels[index] ?? "—";
    return {
      sleutel: naam,
      label: naam,
      // telOp kent het verschil tussen een stroom en een stand; die kennis hoort niet
      // een tweede keer hier te staan.
      totalen: telOp(kubus, groepRijen),
      aantalRijen: groepRijen.length,
    };
  });
}

/**
 * Groepeert op tijd — de reeks onder de grafiek.
 *
 * Twee dingen die hier bewust gebeuren:
 *
 *  - **Lege periodes blijven staan.** Een week zonder uitgaven hoort als nul in de
 *    grafiek, niet als een gat waar de lijn overheen springt. Zonder dit lijkt een
 *    stilgevallen campagne een vlakke lijn in plaats van een val naar nul.
 *  - **De volgorde komt uit de sleutel, niet uit de data.** De sleutels sorteren
 *    alfabetisch chronologisch (2026-01 < 2026-02, 2026-W02 < 2026-W10), dus de reeks
 *    klopt ook als de rijen door elkaar binnenkomen.
 */
export function groepeerPerPeriode(
  kubus: Kubus,
  rijen: number[][],
  korrel: Korrel,
): Groep[] {
  const kolom = kubus.dimensies.indexOf("datum");
  if (kolom === -1) return [];
  const datums = kubus.labels.datum ?? [];
  const start = kubus.dimensies.length;

  // De server levert al op dag- of weekkorrel; fijner dan dat kan de pagina niet vragen.
  const effectief: Korrel = kubus.korrel === "week" && korrel === "dag" ? "week" : korrel;

  const perPeriode = new Map<string, number[][]>();
  for (const rij of rijen) {
    const datum = datums[rij[kolom]];
    if (!datum) continue;
    const sleutel = periodeSleutel(datum, effectief);
    const bestaand = perPeriode.get(sleutel);
    if (bestaand) bestaand.push(rij);
    else perPeriode.set(sleutel, [rij]);
  }
  void start;

  // Alle periodes tussen de eerste en de laatste dag, ook die waar geen enkele rij in
  // valt. Bewust dag voor dag aflopen in plaats van alleen de voorkomende datums
  // omzetten: bij een week waarin niets gebeurde staat er geen enkele datum in de
  // labels, en dan zou juist de periode die je wilt zien uit de reeks verdwijnen.
  const alle = new Set<string>(perPeriode.keys());
  const gesorteerd = [...datums].sort();
  const eerste = gesorteerd[0];
  const laatste = gesorteerd[gesorteerd.length - 1];
  if (eerste && laatste) {
    const loper = new Date(`${eerste}T00:00:00Z`);
    const eind = new Date(`${laatste}T00:00:00Z`);
    while (loper <= eind) {
      alle.add(periodeSleutel(loper.toISOString().slice(0, 10), effectief));
      loper.setUTCDate(loper.getUTCDate() + 1);
    }
  }

  return [...alle].sort().map((sleutel) => {
    const groepRijen = perPeriode.get(sleutel) ?? [];
    return {
      sleutel,
      label: periodeLabel(sleutel, effectief),
      // Binnen één periode geldt voor een stand opnieuw: de laatste meting per account,
      // niet de som van de dagen in die week.
      totalen: telOp(kubus, groepRijen),
      aantalRijen: groepRijen.length,
    };
  });
}

/**
 * Welke korrels mag de gebruiker kiezen bij deze periode?
 *
 * Een kwartaalgrafiek over twee weken is één staaf, en een daggrafiek over een jaar is
 * 365 onleesbare streepjes. Een korrel die niets oplevert hoort niet aanklikbaar te zijn
 * in plaats van een lege grafiek te tonen.
 */
export function bruikbareKorrels(kubus: Kubus): Korrel[] {
  const datums = kubus.labels.datum ?? [];
  if (datums.length === 0) return ["dag"];
  const aantalDagen = datums.length;

  const korrels: Korrel[] = [];
  // De server vat boven de 120 dagen al samen tot weken; dan is dag niet meer te geven.
  if (kubus.korrel === "dag" && aantalDagen <= 92) korrels.push("dag");
  if (aantalDagen >= 14) korrels.push("week");
  if (aantalDagen >= 60) korrels.push("maand");
  if (aantalDagen >= 180) korrels.push("kwartaal");
  return korrels.length > 0 ? korrels : ["dag"];
}
