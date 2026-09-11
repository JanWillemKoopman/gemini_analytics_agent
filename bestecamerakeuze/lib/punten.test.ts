import assert from "node:assert/strict";
import { test } from "node:test";
import { berekenPuntenstanden, legeStand, puntenVoor } from "./punten.ts";

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
