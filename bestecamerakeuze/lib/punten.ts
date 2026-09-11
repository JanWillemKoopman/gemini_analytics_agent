// Alleen het type, geen waarde-import: zo blijft dit bestand zonder runtime-afhankelijk-
// heden en kan `node --test` het rechtstreeks draaien (zie lib/punten.test.ts).
import type { NotitieSoort } from "@/lib/notities";

/**
 * De puntentelling achter het tabblad "Kennis en acties".
 *
 * Waarom: het vastleggen van wat je ziet, denkt en besluit is het waardevolste en tegelijk
 * het makkelijkst over te slaan onderdeel van het weekoverleg. Een zichtbare stand per
 * collega maakt van die gewoonte iets dat je van elkaar ziet gebeuren. Het is bewust géén
 * ranglijst met een winnaar: de stand staat naast elkaar op één rij, en telt standaard
 * alleen de laatste 30 dagen — wie een tijd niets bijdroeg, kan volgende maand gewoon weer
 * meedoen.
 *
 * De weging volgt hoe zwaar een aantekening weegt in het overleg, niet hoeveel typewerk
 * hij kost: een hypothese (de enige soort die een verwachting uitspreekt die fout kan
 * blijken) telt het zwaarst, een actie het lichtst — die volgt meestal vanzelf uit een
 * besluit.
 */
export const PUNTEN_PER_SOORT: Record<NotitieSoort, number> = {
  observatie: 10,
  hypothese: 20,
  besluit: 10,
  actie: 5,
};

export function puntenVoor(soort: NotitieSoort): number {
  return PUNTEN_PER_SOORT[soort] ?? 0;
}

/** Het aantal dagen dat het scorebord terugkijkt; `null` = sinds het begin. */
export type PuntenPeriode = 30 | 90 | null;

export interface Puntenstand {
  /** Punten in de gekozen periode. */
  punten: number;
  /** Punten in de even lange periode dáárvoor; null als er geen vergelijking is. */
  vorige: number | null;
  /**
   * Procentuele verandering t.o.v. die vorige periode. Null wanneer er niets is om
   * tegen af te zetten (periode "alles", of vorige periode op nul) — dan verzint de UI
   * geen oneindig percentage maar zegt "nieuw" of niets.
   */
  verandering: number | null;
  /** Aantal berichten in de gekozen periode — de teller onder de punten. */
  aantal: number;
}

export interface PuntenInvoer {
  aangemaaktDoor: string;
  soort: NotitieSoort;
  aangemaaktOp: string;
}

const DAG_MS = 24 * 60 * 60 * 1000;

function binnen(iso: string, vanaf: number, tot: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= vanaf && t < tot;
}

/**
 * De stand per gebruiker-id. Gebruikers zonder bericht komen hier niet in voor; het
 * scorebord vult die zelf aan met een nulstand, zodat iedere collega op de rij staat —
 * ook (juist) wie nog niets heeft vastgelegd.
 */
export function berekenPuntenstanden(
  items: PuntenInvoer[],
  periode: PuntenPeriode,
  nu: Date = new Date(),
): Record<string, Puntenstand> {
  const eind = nu.getTime();
  const start = periode === null ? -Infinity : eind - periode * DAG_MS;
  const vorigeStart = periode === null ? -Infinity : start - periode * DAG_MS;

  const standen: Record<string, Puntenstand> = {};

  for (const item of items) {
    const stand = (standen[item.aangemaaktDoor] ??= {
      punten: 0,
      vorige: periode === null ? null : 0,
      verandering: null,
      aantal: 0,
    });
    const punten = puntenVoor(item.soort);

    if (binnen(item.aangemaaktOp, start, eind + 1)) {
      stand.punten += punten;
      stand.aantal += 1;
    } else if (periode !== null && binnen(item.aangemaaktOp, vorigeStart, start)) {
      stand.vorige = (stand.vorige ?? 0) + punten;
    }
  }

  for (const stand of Object.values(standen)) {
    stand.verandering =
      stand.vorige === null || stand.vorige === 0
        ? null
        : Math.round(((stand.punten - stand.vorige) / stand.vorige) * 100);
  }

  return standen;
}

/** Een lege stand voor een collega die in deze periode niets heeft vastgelegd. */
export function legeStand(periode: PuntenPeriode): Puntenstand {
  return { punten: 0, vorige: periode === null ? null : 0, verandering: null, aantal: 0 };
}

/* ------------------------------------------------------------------ medailles */

/** Goud, zilver of brons — de plek op het scorebord, niet de volgorde waarin je staat. */
export type Medaille = 1 | 2 | 3;

/**
 * Wie krijgt er een medaille?
 *
 * De rij collega's blijft op naam gesorteerd (A–Z); een medaille is het enige wat de
 * stand zichtbaar maakt. Gelijk aantal punten geeft dezelfde medaille — twee keer goud
 * en daarna brons overslaan zou een verschil suggereren dat er niet is. Alleen de drie
 * hoogste puntentotalen tellen mee, en nul punten levert nooit een medaille op: een
 * rustige maand hoort niet bekroond te worden.
 */
export function bepaalMedailles(
  standen: Record<string, { punten: number }>,
): Record<string, Medaille> {
  const totalen = Array.from(
    new Set(
      Object.values(standen)
        .map((stand) => stand.punten)
        .filter((punten) => punten > 0),
    ),
  )
    .sort((a, b) => b - a)
    .slice(0, 3);

  const medailles: Record<string, Medaille> = {};
  for (const [id, stand] of Object.entries(standen)) {
    const plek = totalen.indexOf(stand.punten);
    if (plek !== -1) medailles[id] = (plek + 1) as Medaille;
  }
  return medailles;
}

/* --------------------------------------------------------------------- weken */

/**
 * De puntenweek is de eenheid van het scoretabblad: hij loopt van maandag 11:59 tot
 * maandag 11:59 (zie lib/week.ts) en bepaalt wie er die week #1, #2 en #3 is.
 *
 * Waarom de weekfuncties hieronder een lijst vensters ingestopt krijgen in plaats van
 * die zelf uit te rekenen: dit bestand blijft daardoor vrij van runtime-imports, en de
 * tests kunnen elke week expliciet neerzetten in plaats van rond "nu" te moeten rekenen.
 */
import type { Weekvenster } from "@/lib/week";

/**
 * Bonus voor het voortzetten van een streak: heb je vorige week iets vastgelegd en deze
 * week weer, dan levert die tweede week (en elke week daarna) dit aantal punten extra
 * op. De eerste week van een reeks geeft nog niets — anders is "een streak" gewoon een
 * andere naam voor "een bericht".
 */
export const STREAK_BONUS = 30;

/**
 * Het weekdoel van het team schaalt mee met het aantal collega's: per persoon één
 * hypothese (20) of drie observaties (30) per week. Zo blijft het doel kloppen wanneer
 * er iemand bij komt, en is het in één zin uit te leggen.
 */
export const WEEKDOEL_PER_COLLEGA = 30;

export function teamWeekdoel(aantalCollegas: number): number {
  return Math.max(WEEKDOEL_PER_COLLEGA, aantalCollegas * WEEKDOEL_PER_COLLEGA);
}

export interface Weekpunten {
  /** Punten uit de berichten zelf. */
  basis: number;
  /** Streakbonus in deze week (0 of STREAK_BONUS). */
  bonus: number;
  /** basis + bonus — dit is wat er op het scherm staat. */
  punten: number;
  aantal: number;
  /** Aantal weken op rij t/m deze week waarin deze collega iets vastlegde. */
  streak: number;
}

export interface Weekuitslag {
  venster: Weekvenster;
  perGebruiker: Record<string, Weekpunten>;
  /** #1, #2 en #3 van déze week — ze vervallen bij de volgende reset. */
  medailles: Record<string, Medaille>;
  teampunten: number;
  teamaantal: number;
  /** Is deze week al afgelopen? Alleen dan is de uitslag definitief. */
  afgelopen: boolean;
}

export function legeWeekpunten(): Weekpunten {
  return { basis: 0, bonus: 0, punten: 0, aantal: 0, streak: 0 };
}

/**
 * De uitslag per week, oud naar nieuw, met de streak als lopende teller: elke week
 * waarin iemand iets vastlegt verlengt zijn reeks, een lege week zet hem op nul. Vanaf
 * de tweede week op rij levert dat STREAK_BONUS extra punten op in díe week.
 */
export function berekenWeekuitslagen(
  items: PuntenInvoer[],
  vensters: Weekvenster[],
  nu: Date = new Date(),
): Weekuitslag[] {
  const streaks: Record<string, number> = {};
  // Eerst elk bericht één keer in zijn week leggen (binair zoeken op de weekgrenzen)
  // in plaats van per week de hele lijst door te lopen: de totaalstand kijkt terug tot
  // het eerste bericht, dus dat tweede zou met de jaren een lijst × weken worden.
  const emmers: Record<string, Weekpunten>[] = vensters.map(() => ({}));
  const grenzen = vensters.map((venster) => venster.start.getTime());

  for (const item of items) {
    const t = new Date(item.aangemaaktOp).getTime();
    if (!Number.isFinite(t)) continue;

    let laag = 0;
    let hoog = grenzen.length - 1;
    let index = -1;
    while (laag <= hoog) {
      const midden = (laag + hoog) >> 1;
      if (grenzen[midden] <= t) {
        index = midden;
        laag = midden + 1;
      } else {
        hoog = midden - 1;
      }
    }
    // Vóór de eerste week, of ná het einde van de laatste: telt nergens mee.
    if (index === -1 || t >= vensters[index].eind.getTime()) continue;

    const stand = (emmers[index][item.aangemaaktDoor] ??= legeWeekpunten());
    stand.basis += puntenVoor(item.soort);
    stand.aantal += 1;
  }

  const uitslagen: Weekuitslag[] = [];

  for (const [i, venster] of vensters.entries()) {
    const perGebruiker = emmers[i];

    // De streak van wie deze week niets vastlegde valt terug naar nul — ook als hij
    // niet in perGebruiker voorkomt.
    for (const id of Object.keys(streaks)) {
      if (!perGebruiker[id]) streaks[id] = 0;
    }

    for (const [id, stand] of Object.entries(perGebruiker)) {
      streaks[id] = (streaks[id] ?? 0) + 1;
      stand.streak = streaks[id];
      stand.bonus = stand.streak >= 2 ? STREAK_BONUS : 0;
      stand.punten = stand.basis + stand.bonus;
    }

    uitslagen.push({
      venster,
      perGebruiker,
      medailles: bepaalMedailles(perGebruiker),
      teampunten: Object.values(perGebruiker).reduce((som, s) => som + s.punten, 0),
      teamaantal: Object.values(perGebruiker).reduce((som, s) => som + s.aantal, 0),
      afgelopen: venster.eind.getTime() <= nu.getTime(),
    });
  }

  return uitslagen;
}

/* ---------------------------------------------------------------- totaalstand */

/** De stand zonder einddatum: alles bij elkaar opgeteld sinds het allereerste bericht. */
export interface Totaalstand {
  punten: number;
  aantal: number;
  /** Hoeveel van die punten uit streakbonussen komen. */
  bonus: number;
  goud: number;
  zilver: number;
  brons: number;
  /** goud + zilver + brons: het aantal keer dat deze collega op het podium stond. */
  prijzen: number;
  /** De reeks die nu loopt (t/m de lopende week). */
  streak: number;
  langsteStreak: number;
}

export function legeTotaalstand(): Totaalstand {
  return {
    punten: 0,
    aantal: 0,
    bonus: 0,
    goud: 0,
    zilver: 0,
    brons: 0,
    prijzen: 0,
    streak: 0,
    langsteStreak: 0,
  };
}

export interface Seizoen {
  /** Elke week sinds het eerste bericht, oud naar nieuw. */
  weken: Weekuitslag[];
  /** De week die nu loopt — de laatste uit `weken`. */
  huidige: Weekuitslag;
  /** De week daarvóór; null als er nog geen historie is. */
  vorige: Weekuitslag | null;
  /** Per collega: alles bij elkaar, zonder einddatum. */
  totalen: Record<string, Totaalstand>;
}

/**
 * Alles wat het scoretabblad nodig heeft in één doorloop over de weken: de weekstanden,
 * de streaks en de totaalstand met de prijzenkast.
 *
 * Prijzen worden alleen geteld uit weken die écht zijn afgelopen. De medailles van de
 * lopende week staan wel op het scherm (dat is de stand van nu), maar komen pas in de
 * prijzenkast zodra de week maandag om 11:59 dichtklapt — anders zou een voorsprong op
 * donderdag al als gewonnen week in de boeken staan.
 */
export function berekenSeizoen(
  items: PuntenInvoer[],
  vensters: Weekvenster[],
  nu: Date = new Date(),
): Seizoen {
  const weken = berekenWeekuitslagen(items, vensters, nu);
  const totalen: Record<string, Totaalstand> = {};

  for (const week of weken) {
    for (const [id, stand] of Object.entries(week.perGebruiker)) {
      const totaal = (totalen[id] ??= legeTotaalstand());
      totaal.punten += stand.punten;
      totaal.bonus += stand.bonus;
      totaal.aantal += stand.aantal;
      totaal.langsteStreak = Math.max(totaal.langsteStreak, stand.streak);
    }

    if (!week.afgelopen) continue;
    for (const [id, plek] of Object.entries(week.medailles)) {
      const totaal = (totalen[id] ??= legeTotaalstand());
      if (plek === 1) totaal.goud += 1;
      else if (plek === 2) totaal.zilver += 1;
      else totaal.brons += 1;
      totaal.prijzen += 1;
    }
  }

  const huidige = weken[weken.length - 1];
  for (const [id, totaal] of Object.entries(totalen)) {
    totaal.streak = huidige.perGebruiker[id]?.streak ?? 0;
  }
  // Wie deze week (nog) niets vastlegde maar vorige week wel, houdt zijn reeks tot de
  // week dichtklapt: die staat als "loopt" op het scherm, niet als afgebroken.
  const vorige = weken.length > 1 ? weken[weken.length - 2] : null;
  if (vorige) {
    for (const [id, stand] of Object.entries(vorige.perGebruiker)) {
      const totaal = (totalen[id] ??= legeTotaalstand());
      if (!huidige.perGebruiker[id]) totaal.streak = stand.streak;
    }
  }

  return { weken, huidige, vorige, totalen };
}

/* ------------------------------------------------------------------- positie */

export interface Positie {
  /** 1-gebaseerd; gelijke standen delen dezelfde plek. */
  plek: number;
  van: number;
  /** Punten die je tekortkomt op de hoogste stand; 0 als je zelf bovenaan staat. */
  achterstand: number;
}

/**
 * Waar sta jij? Bewust alleen voor jezelf op het scherm: de rij collega's blijft
 * alfabetisch, maar je eigen plek weten is precies wat een stand betekenis geeft.
 * Iedereen met nul punten deelt gewoon de laatste plek — geen aparte behandeling.
 */
export function bepaalPositie(
  standen: { id: string; punten: number }[],
  id: string,
): Positie | null {
  const eigen = standen.find((s) => s.id === id);
  if (!eigen) return null;

  const hoogste = standen.reduce((max, s) => Math.max(max, s.punten), 0);
  const plek = standen.filter((s) => s.punten > eigen.punten).length + 1;
  return { plek, van: standen.length, achterstand: Math.max(0, hoogste - eigen.punten) };
}

/* -------------------------------------------------------------- bijdrageprofiel */

/** Waar iemands punten vandaan komen — de inhoud van het hoverkaartje bij een avatar. */
export interface Bijdrageprofiel {
  perSoort: Record<NotitieSoort, number>;
  /** De meest recente bijdrage in de periode, als ISO-tijd. */
  laatste: string | null;
}

export function bijdrageprofielen(
  items: PuntenInvoer[],
  periode: PuntenPeriode,
  nu: Date = new Date(),
): Record<string, Bijdrageprofiel> {
  const eind = nu.getTime();
  const start = periode === null ? -Infinity : eind - periode * DAG_MS;
  const profielen: Record<string, Bijdrageprofiel> = {};

  for (const item of items) {
    if (!binnen(item.aangemaaktOp, start, eind + 1)) continue;
    const profiel = (profielen[item.aangemaaktDoor] ??= {
      perSoort: { observatie: 0, hypothese: 0, besluit: 0, actie: 0 },
      laatste: null,
    });
    profiel.perSoort[item.soort] = (profiel.perSoort[item.soort] ?? 0) + 1;
    if (!profiel.laatste || item.aangemaaktOp > profiel.laatste) {
      profiel.laatste = item.aangemaaktOp;
    }
  }

  return profielen;
}
