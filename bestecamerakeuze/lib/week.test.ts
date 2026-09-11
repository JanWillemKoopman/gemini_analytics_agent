import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isWeekwinnaarVenster,
  resetMomentOpOfVoor,
  tijdTotReset,
  vorigeWeekVenster,
  weekLabel,
  weekSleutel,
  weekVenster,
  weekVenstersTussen,
} from "./week.ts";

// 14 september 2026 is een maandag. In september geldt zomertijd (UTC+2), dus het
// resetmoment 11:59 Nederlandse tijd is 09:59 UTC.
const RESET_SEP = "2026-09-14T09:59:00.000Z";

test("de week begint op maandag 11:59 Nederlandse tijd", () => {
  const { start } = weekVenster(new Date("2026-09-16T08:00:00Z")); // woensdag
  assert.equal(start.toISOString(), RESET_SEP);
});

test("maandagochtend vóór 11:59 hoort nog bij de week die dan afloopt", () => {
  const venster = weekVenster(new Date("2026-09-14T09:58:59Z")); // 11:58:59 NL
  assert.equal(venster.start.toISOString(), "2026-09-07T09:59:00.000Z");
  assert.equal(venster.eind.toISOString(), RESET_SEP);
});

test("om 11:59 precies begint de nieuwe week", () => {
  const venster = weekVenster(new Date(RESET_SEP));
  assert.equal(venster.start.toISOString(), RESET_SEP);
  assert.equal(venster.eind.toISOString(), "2026-09-21T09:59:00.000Z");
});

test("in de winter schuift het resetmoment mee met de klok", () => {
  // 5 januari 2026 is een maandag; wintertijd is UTC+1, dus 11:59 NL = 10:59 UTC.
  const { start } = weekVenster(new Date("2026-01-07T12:00:00Z"));
  assert.equal(start.toISOString(), "2026-01-05T10:59:00.000Z");
});

test("de week over de wintertijd-omschakeling eindigt gewoon om 11:59", () => {
  // De klok gaat achteruit in de nacht van 24 op 25 oktober 2026; die week duurt dus
  // 169 uur, maar begint en eindigt aan beide kanten om 11:59 Nederlandse tijd.
  const venster = weekVenster(new Date("2026-10-21T12:00:00Z"));
  assert.equal(venster.start.toISOString(), "2026-10-19T09:59:00.000Z");
  assert.equal(venster.eind.toISOString(), "2026-10-26T10:59:00.000Z");
});

test("de pop-up verschijnt alleen maandag tussen 00:00 en 11:58", () => {
  assert.equal(isWeekwinnaarVenster(new Date("2026-09-13T22:30:00Z")), true); // ma 00:30 NL
  assert.equal(isWeekwinnaarVenster(new Date("2026-09-14T09:58:00Z")), true); // ma 11:58 NL
  assert.equal(isWeekwinnaarVenster(new Date("2026-09-14T09:59:00Z")), false); // ma 11:59 NL
  assert.equal(isWeekwinnaarVenster(new Date("2026-09-14T14:00:00Z")), false); // ma 16:00 NL
  assert.equal(isWeekwinnaarVenster(new Date("2026-09-15T06:00:00Z")), false); // dinsdag
});

test("de vorige week sluit naadloos aan op de huidige", () => {
  const huidig = weekVenster(new Date("2026-09-16T08:00:00Z"));
  const vorig = vorigeWeekVenster(huidig);
  assert.equal(vorig.eind.getTime(), huidig.start.getTime());
  assert.equal(vorig.start.toISOString(), "2026-09-07T09:59:00.000Z");
});

test("weekVenstersTussen levert elke week één keer, oud naar nieuw", () => {
  const vensters = weekVenstersTussen(
    new Date("2026-08-25T10:00:00Z"),
    new Date("2026-09-16T08:00:00Z"),
  );
  assert.equal(vensters.length, 4);
  assert.equal(vensters[0].start.toISOString(), "2026-08-24T09:59:00.000Z");
  assert.equal(vensters[3].start.toISOString(), RESET_SEP);
  for (let i = 1; i < vensters.length; i += 1) {
    assert.equal(vensters[i].start.getTime(), vensters[i - 1].eind.getTime());
  }
});

test("sleutel en label beschrijven dezelfde week", () => {
  const venster = weekVenster(new Date("2026-09-16T08:00:00Z"));
  assert.equal(weekSleutel(venster), "2026-09-14");
  assert.equal(weekLabel(venster), "14 sep – 21 sep");
});

test("resetMomentOpOfVoor geeft het moment zelf terug als dat het resetmoment is", () => {
  assert.equal(resetMomentOpOfVoor(new Date(RESET_SEP)).toISOString(), RESET_SEP);
});

test("tijd tot reset telt af naar maandag 11:59", () => {
  assert.deepEqual(tijdTotReset(new Date("2026-09-18T09:59:00Z")), { dagen: 3, uren: 0 });
  assert.deepEqual(tijdTotReset(new Date("2026-09-21T07:59:00Z")), { dagen: 0, uren: 2 });
});

test("bij een absurd oude begindatum blijft de lopende week de laatste", () => {
  const nu = new Date("2026-09-16T08:00:00Z");
  const vensters = weekVenstersTussen(new Date("1990-01-01T00:00:00Z"), nu);
  assert.ok(vensters.length <= 520);
  assert.equal(vensters[vensters.length - 1].start.toISOString(), RESET_SEP);
});
