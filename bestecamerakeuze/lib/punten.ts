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
export function bepaalMedailles(standen: Record<string, Puntenstand>): Record<string, Medaille> {
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
