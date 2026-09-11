/**
 * De puntenweek: van maandag 11:59 tot maandag 11:59, Nederlandse tijd.
 *
 * Waarom dit een eigen bestand is: "deze week" is op het scoretabblad geen kalenderweek
 * maar een afspraak van het team — de stand loopt tot maandagochtend 11:59 (Europe/
 * Amsterdam) en klapt dan om naar een nieuwe week. Dat moment bepaalt drie dingen
 * tegelijk: welke berichten meetellen voor de weekpunten, wanneer de medailles #1/#2/#3
 * opnieuw verdeeld worden, en tot hoe laat de weekwinnaar-pop-up nog te zien is. Eén
 * definitie, op één plek, zodat die drie niet uit elkaar kunnen lopen.
 *
 * Geen runtime-afhankelijkheden (alleen `Intl`), zodat `node --test` dit bestand
 * rechtstreeks kan draaien — zie lib/week.test.ts.
 */

/** Nederlandse tijdzone; de enige die dit dashboard kent. */
const ZONE = "Europe/Amsterdam";

const DAG_MS = 24 * 60 * 60 * 1000;

/** Maandag. `Date.getUTCDay()`-nummering: 0 = zondag. */
const RESET_DAG = 1;
export const RESET_UUR = 11;
export const RESET_MINUUT = 59;

/** "11:59" — het tijdstip van de reset, voor in de UI. */
export const RESET_TIJD = `${RESET_UUR}:${String(RESET_MINUUT).padStart(2, "0")}`;

/** "maandag 11:59" — het resetmoment in woorden. */
export const RESET_LABEL = `maandag ${RESET_TIJD}`;

export interface Weekvenster {
  /** Inclusief: het resetmoment waarop deze week begon. */
  start: Date;
  /** Exclusief: het resetmoment waarop deze week afloopt. */
  eind: Date;
}

const DEEL_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Het verschil tussen de Nederlandse klok en UTC op dat moment (+1 uur in de winter,
 * +2 in de zomer). Berekend door de Nederlandse wandkloktijd te lezen en die te
 * behandelen alsof het UTC was — het verschil met het echte moment ís de offset.
 */
function offsetMs(moment: Date): number {
  const delen: Record<string, number> = {};
  for (const deel of DEEL_FORMAT.formatToParts(moment)) {
    if (deel.type !== "literal") delen[deel.type] = Number(deel.value);
  }
  const alsUtc = Date.UTC(
    delen.year,
    delen.month - 1,
    delen.day,
    delen.hour,
    delen.minute,
    delen.second,
  );
  return alsUtc - Math.floor(moment.getTime() / 1000) * 1000;
}

/**
 * Hetzelfde moment, maar zo verschoven dat de UTC-velden (`getUTCHours()` enzovoort) de
 * Nederlandse wandkloktijd teruggeven. Handig om op "welke dag/hoe laat is het hier?" te
 * rekenen zonder een tijdzonebibliotheek.
 */
function naarLokaal(moment: Date): Date {
  return new Date(moment.getTime() + offsetMs(moment));
}

/**
 * De omgekeerde weg: een Nederlandse wandkloktijd (als UTC-milliseconden uitgedrukt)
 * terug naar het echte moment.
 *
 * De offset wordt op het lokale moment zelf bepaald. Dat is alleen dubbelzinnig in het
 * uur waarin de klok verspringt (nacht van zaterdag op zondag, 02:00/03:00); 11:59 op
 * maandag ligt daar ver vandaan, dus voor het resetmoment is dit exact.
 */
function vanLokaal(lokaalMs: number): Date {
  const benadering = new Date(lokaalMs);
  return new Date(lokaalMs - offsetMs(benadering));
}

/** Het meest recente resetmoment (maandag 11:59) op of vóór `moment`. */
export function resetMomentOpOfVoor(moment: Date): Date {
  const lokaal = naarLokaal(moment);
  // 0 op maandag, 6 op zondag: zoveel dagen terug ligt de maandag van deze week.
  const dagenSindsMaandag = (lokaal.getUTCDay() - RESET_DAG + 7) % 7;
  let resetLokaal =
    Date.UTC(
      lokaal.getUTCFullYear(),
      lokaal.getUTCMonth(),
      lokaal.getUTCDate(),
      RESET_UUR,
      RESET_MINUUT,
      0,
      0,
    ) -
    dagenSindsMaandag * DAG_MS;

  // Maandagochtend vóór 11:59 hoort nog bij de week die dan pas afloopt.
  if (lokaal.getTime() < resetLokaal) resetLokaal -= 7 * DAG_MS;

  return vanLokaal(resetLokaal);
}

/** Het eerstvolgende resetmoment ná `moment`. */
export function volgendeReset(moment: Date): Date {
  const start = resetMomentOpOfVoor(moment);
  // Acht dagen verder valt altijd in de week erna; het resetmoment daarvóór is dus de
  // volgende maandag 11:59. Via de wandklok gerekend, zodat een zomer-/wintertijdweek
  // gewoon 11:59 blijft eindigen in plaats van een uur te verschuiven.
  return resetMomentOpOfVoor(new Date(start.getTime() + 8 * DAG_MS));
}

/** De week waarin `nu` valt. */
export function weekVenster(nu: Date = new Date()): Weekvenster {
  const start = resetMomentOpOfVoor(nu);
  return { start, eind: volgendeReset(start) };
}

/** De week vóór dit venster. */
export function vorigeWeekVenster(venster: Weekvenster): Weekvenster {
  const start = resetMomentOpOfVoor(new Date(venster.start.getTime() - 1));
  return { start, eind: venster.start };
}

/** Valt dit tijdstip binnen de week? Ondergrens inclusief, bovengrens exclusief. */
export function valtInWeek(iso: string, venster: Weekvenster): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= venster.start.getTime() && t < venster.eind.getTime();
}

/**
 * Alle weekvensters van de week waarin `vanaf` valt tot en met de week waarin `tot`
 * valt — de basis onder de totaalstand en de streaks.
 */
export function weekVenstersTussen(vanaf: Date, tot: Date): Weekvenster[] {
  const eerste = weekVenster(vanaf);
  let venster = weekVenster(tot);
  const vensters: Weekvenster[] = [venster];

  // Van achteren naar voren opgebouwd, met een bovengrens van tien jaar. Die kant op,
  // omdat de lopende week er hoe dan ook bij moet horen: een onverwacht oude datum in de
  // data mag hooguit de oudste weken afkappen, nooit de week van nu.
  while (venster.start > eerste.start && vensters.length < 520) {
    venster = vorigeWeekVenster(venster);
    vensters.push(venster);
  }

  return vensters.reverse();
}

/** Stabiele sleutel per week ("2026-09-07"), voor React-keys en localStorage. */
export function weekSleutel(venster: Weekvenster): string {
  const lokaal = naarLokaal(venster.start);
  const maand = String(lokaal.getUTCMonth() + 1).padStart(2, "0");
  const dag = String(lokaal.getUTCDate()).padStart(2, "0");
  return `${lokaal.getUTCFullYear()}-${maand}-${dag}`;
}

const DATUM_KORT = new Intl.DateTimeFormat("nl-NL", {
  timeZone: ZONE,
  day: "numeric",
  month: "short",
});

/** "8 sep – 15 sep": de looptijd van een week, zoals hij in de UI staat. */
export function weekLabel(venster: Weekvenster): string {
  return `${DATUM_KORT.format(venster.start)} – ${DATUM_KORT.format(venster.eind)}`;
}

/**
 * Is het nu maandagochtend vóór de reset (00:00–11:58)? Dat is het venster waarin de
 * weekwinnaar-pop-up verschijnt: de week die om 11:59 afloopt is dan in de praktijk
 * gelopen, en iedereen begint zijn week met de uitslag op het scherm.
 */
export function isWeekwinnaarVenster(nu: Date = new Date()): boolean {
  const lokaal = naarLokaal(nu);
  if (lokaal.getUTCDay() !== RESET_DAG) return false;
  const minutenVandaag = lokaal.getUTCHours() * 60 + lokaal.getUTCMinutes();
  return minutenVandaag < RESET_UUR * 60 + RESET_MINUUT;
}

/** Hoeveel hele dagen en uren er nog tot de reset zijn — voor de regel onder de stand. */
export function tijdTotReset(nu: Date = new Date()): { dagen: number; uren: number } {
  const over = Math.max(0, weekVenster(nu).eind.getTime() - nu.getTime());
  return {
    dagen: Math.floor(over / DAG_MS),
    uren: Math.floor((over % DAG_MS) / (60 * 60 * 1000)),
  };
}
