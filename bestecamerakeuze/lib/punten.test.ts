import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STREAK_BONUS,
  bepaalMedailles,
  bepaalPositie,
  berekenPuntenstanden,
  berekenSeizoen,
  berekenWeekuitslagen,
  bijdrageprofielen,
  legeStand,
  puntenVoor,
  teamWeekdoel,
} from "./punten.ts";
import { weekVenstersTussen } from "./week.ts";

const NU = new Date("2026-03-31T12:00:00Z");

/** N dagen vóór het peilmoment, als ISO-string. */
function dagenGeleden(dagen: number): string {
  return new Date(NU.getTime() - dagen * 24 * 60 * 60 * 1000).toISOString();
}

test("weegt elke soort volgens de afgesproken punten", () => {
  assert.equal(puntenVoor("observatie"), 10);
  assert.equal(puntenVoor("hypothese"), 20);
  assert.equal(puntenVoor("besluit"), 10);
  assert.equal(puntenVoor("actie"), 5);
});

test("telt alleen de gekozen periode en vergelijkt met de periode daarvóór", () => {
  const standen = berekenPuntenstanden(
    [
      { aangemaaktDoor: "a", soort: "hypothese", aangemaaktOp: dagenGeleden(1) }, // 20
      { aangemaaktDoor: "a", soort: "actie", aangemaaktOp: dagenGeleden(29) }, //  5
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: dagenGeleden(40) }, // vorige periode
      { aangemaaktDoor: "a", soort: "besluit", aangemaaktOp: dagenGeleden(90) }, // valt buiten beide
    ],
    30,
    NU,
  );

  assert.equal(standen.a.punten, 25);
  assert.equal(standen.a.aantal, 2);
  assert.equal(standen.a.vorige, 10);
  assert.equal(standen.a.verandering, 150);
});

test("verzint geen percentage als er niets was om mee te vergelijken", () => {
  const standen = berekenPuntenstanden(
    [{ aangemaaktDoor: "b", soort: "observatie", aangemaaktOp: dagenGeleden(2) }],
    30,
    NU,
  );
  assert.equal(standen.b.punten, 10);
  assert.equal(standen.b.vorige, 0);
  assert.equal(standen.b.verandering, null);
});

test("periode 'alles' telt alles en vergelijkt niet", () => {
  const standen = berekenPuntenstanden(
    [
      { aangemaaktDoor: "c", soort: "observatie", aangemaaktOp: dagenGeleden(2) },
      { aangemaaktDoor: "c", soort: "besluit", aangemaaktOp: dagenGeleden(400) },
    ],
    null,
    NU,
  );
  assert.equal(standen.c.punten, 20);
  assert.equal(standen.c.aantal, 2);
  assert.equal(standen.c.vorige, null);
  assert.equal(standen.c.verandering, null);
});

test("een collega zonder berichten krijgt een nulstand", () => {
  assert.deepEqual(legeStand(30), { punten: 0, vorige: 0, verandering: null, aantal: 0 });
  assert.deepEqual(legeStand(null), { punten: 0, vorige: null, verandering: null, aantal: 0 });
});

/** Kleine hulp: alleen het puntenaantal telt voor de medailles. */
function stand(punten: number) {
  return { punten, vorige: 0, verandering: null, aantal: 1 };
}

test("geeft goud, zilver en brons aan de drie hoogste totalen", () => {
  const medailles = bepaalMedailles({
    a: stand(40),
    b: stand(30),
    c: stand(20),
    d: stand(10),
  });
  assert.deepEqual(medailles, { a: 1, b: 2, c: 3 });
});

test("gelijke stand deelt dezelfde medaille", () => {
  const medailles = bepaalMedailles({
    a: stand(30),
    b: stand(30),
    c: stand(20),
    d: stand(10),
  });
  assert.deepEqual(medailles, { a: 1, b: 1, c: 2, d: 3 });
});

test("nul punten levert nooit een medaille op", () => {
  const medailles = bepaalMedailles({ a: stand(10), b: stand(0), c: stand(0) });
  assert.deepEqual(medailles, { a: 1 });
});

/* ------------------------------------------------------- weken, streaks, totalen */

// Woensdag 16 september 2026, 10:00 UTC — midden in de week die maandag 14 september
// om 11:59 (Nederlandse tijd) begon.
const WOENSDAG = new Date("2026-09-16T10:00:00Z");

/** Een moment binnen de week die `wekenTerug` weken geleden liep. */
function inWeek(wekenTerug: number, uurInDeWeek = 24): string {
  const vensters = weekVenstersTussen(
    new Date(WOENSDAG.getTime() - wekenTerug * 7 * 24 * 60 * 60 * 1000),
    WOENSDAG,
  );
  const venster = vensters[vensters.length - 1 - wekenTerug] ?? vensters[0];
  return new Date(venster.start.getTime() + uurInDeWeek * 60 * 60 * 1000).toISOString();
}

test("de weekstand telt alleen berichten binnen het weekvenster", () => {
  const vensters = weekVenstersTussen(new Date(inWeek(1)), WOENSDAG);
  const uitslagen = berekenWeekuitslagen(
    [
      { aangemaaktDoor: "a", soort: "hypothese", aangemaaktOp: inWeek(0) }, // 20
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(1) }, // vorige week
    ],
    vensters,
    WOENSDAG,
  );

  assert.equal(uitslagen.length, 2);
  assert.equal(uitslagen[0].perGebruiker.a.basis, 10);
  assert.equal(uitslagen[1].perGebruiker.a.basis, 20);
  assert.equal(uitslagen[1].afgelopen, false);
  assert.equal(uitslagen[0].afgelopen, true);
});

test("twee weken op rij levert de streakbonus op, de eerste week niet", () => {
  const uitslagen = berekenWeekuitslagen(
    [
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(1) },
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(0) },
    ],
    weekVenstersTussen(new Date(inWeek(1)), WOENSDAG),
    WOENSDAG,
  );

  assert.equal(uitslagen[0].perGebruiker.a.streak, 1);
  assert.equal(uitslagen[0].perGebruiker.a.bonus, 0);
  assert.equal(uitslagen[1].perGebruiker.a.streak, 2);
  assert.equal(uitslagen[1].perGebruiker.a.bonus, STREAK_BONUS);
  assert.equal(uitslagen[1].perGebruiker.a.punten, 10 + STREAK_BONUS);
});

test("een lege week breekt de streak", () => {
  const uitslagen = berekenWeekuitslagen(
    [
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(2) },
      // week 1: niets
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(0) },
    ],
    weekVenstersTussen(new Date(inWeek(2)), WOENSDAG),
    WOENSDAG,
  );

  assert.equal(uitslagen[2].perGebruiker.a.streak, 1);
  assert.equal(uitslagen[2].perGebruiker.a.bonus, 0);
});

test("prijzen tellen alleen uit weken die zijn afgelopen", () => {
  const seizoen = berekenSeizoen(
    [
      { aangemaaktDoor: "a", soort: "hypothese", aangemaaktOp: inWeek(1) }, // wint week 1
      { aangemaaktDoor: "b", soort: "actie", aangemaaktOp: inWeek(1) },
      { aangemaaktDoor: "b", soort: "hypothese", aangemaaktOp: inWeek(0) }, // leidt nu
    ],
    weekVenstersTussen(new Date(inWeek(1)), WOENSDAG),
    WOENSDAG,
  );

  assert.equal(seizoen.totalen.a.goud, 1);
  assert.equal(seizoen.totalen.a.prijzen, 1);
  // b staat deze week op #1, maar de week loopt nog: nog geen prijs.
  assert.equal(seizoen.totalen.b.goud, 0);
  assert.equal(seizoen.totalen.b.zilver, 1); // wel de zilveren van vorige week
  assert.equal(seizoen.huidige.medailles.b, 1);
});

test("de totaalstand telt alle punten inclusief bonus, zonder einddatum", () => {
  const seizoen = berekenSeizoen(
    [
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(2) }, // 10
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(1) }, // 10 + 30 bonus
      { aangemaaktDoor: "a", soort: "besluit", aangemaaktOp: inWeek(0) }, // 10 + 30 bonus
    ],
    weekVenstersTussen(new Date(inWeek(2)), WOENSDAG),
    WOENSDAG,
  );

  assert.equal(seizoen.totalen.a.punten, 30 + 2 * STREAK_BONUS);
  assert.equal(seizoen.totalen.a.bonus, 2 * STREAK_BONUS);
  assert.equal(seizoen.totalen.a.aantal, 3);
  assert.equal(seizoen.totalen.a.streak, 3);
  assert.equal(seizoen.totalen.a.langsteStreak, 3);
});

test("een lopende reeks blijft staan zolang de week nog niet dicht is", () => {
  const seizoen = berekenSeizoen(
    [{ aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: inWeek(1) }],
    weekVenstersTussen(new Date(inWeek(1)), WOENSDAG),
    WOENSDAG,
  );

  // Deze week nog niets vastgelegd: de reeks van vorige week telt door tot de reset.
  assert.equal(seizoen.huidige.perGebruiker.a, undefined);
  assert.equal(seizoen.totalen.a.streak, 1);
});

test("je eigen positie deelt plekken bij een gelijke stand", () => {
  const standen = [
    { id: "a", punten: 50 },
    { id: "b", punten: 50 },
    { id: "c", punten: 20 },
    { id: "d", punten: 0 },
  ];

  assert.deepEqual(bepaalPositie(standen, "a"), { plek: 1, van: 4, achterstand: 0 });
  assert.deepEqual(bepaalPositie(standen, "b"), { plek: 1, van: 4, achterstand: 0 });
  assert.deepEqual(bepaalPositie(standen, "c"), { plek: 3, van: 4, achterstand: 30 });
  assert.equal(bepaalPositie(standen, "x"), null);
});

test("het teamdoel schaalt mee met het aantal collega's", () => {
  assert.equal(teamWeekdoel(5), 150);
  assert.equal(teamWeekdoel(0), 30);
});

test("het bijdrageprofiel splitst de punten uit naar soort", () => {
  const profielen = bijdrageprofielen(
    [
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: dagenGeleden(1) },
      { aangemaaktDoor: "a", soort: "observatie", aangemaaktOp: dagenGeleden(3) },
      { aangemaaktDoor: "a", soort: "hypothese", aangemaaktOp: dagenGeleden(2) },
      { aangemaaktDoor: "a", soort: "besluit", aangemaaktOp: dagenGeleden(40) }, // buiten periode
    ],
    30,
    NU,
  );

  assert.equal(profielen.a.perSoort.observatie, 2);
  assert.equal(profielen.a.perSoort.hypothese, 1);
  assert.equal(profielen.a.perSoort.besluit, 0);
  assert.equal(profielen.a.laatste, dagenGeleden(1));
});
