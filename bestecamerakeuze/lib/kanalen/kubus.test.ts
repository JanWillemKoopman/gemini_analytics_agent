import assert from "node:assert/strict";
import { test } from "node:test";
import {
  beschikbareWaarden,
  bruikbareKorrels,
  filter,
  groepeer,
  groepeerPerPeriode,
  isoWeek,
  periodeBereik,
  periodeLabel,
  periodeSleutel,
  standaardKorrel,
  telOp,
  waardeVan,
  type Kubus,
} from "./kubus.ts";
import { ADVERTENTIE_STATISTIEKEN } from "../windsor/velden.ts";

function statistiek(id: string) {
  const s = ADVERTENTIE_STATISTIEKEN.find((x) => x.id === id);
  assert.ok(s, `statistiek ${id} bestaat niet`);
  return s;
}

/**
 * Een kleine kubus met twee dagen, twee accounts en twee platforms. De cijfers zijn
 * bewust ongelijk verdeeld: een rij met veel vertoningen en weinig klikken naast een rij
 * met weinig vertoningen en veel klikken, zodat een ten onrechte gemiddelde CTR meteen
 * een ander getal oplevert dan de juiste.
 */
const kubus: Kubus = {
  dimensies: ["datum", "account", "platform"],
  labels: {
    datum: ["2026-09-07", "2026-09-08"],
    account: ["Udenhout", "Porsche"],
    platform: ["facebook", "instagram"],
  },
  kolommen: ["uitgaven", "vertoningen", "klikken", "leads"],
  rijen: [
    // datum, account, platform, uitgaven, vertoningen, klikken, leads
    [0, 0, 0, 100, 10000, 100, 5],
    [0, 1, 1, 10, 100, 50, 1],
    [1, 0, 0, 200, 20000, 100, 4],
    [1, 1, 1, 20, 200, 50, 0],
  ],
  korrel: "dag",
  periode: { van: "2026-09-07", tot: "2026-09-08" },
};

test("optellen telt alle meetkolommen bij elkaar", () => {
  const totalen = telOp(kubus, kubus.rijen);
  assert.equal(totalen.uitgaven, 330);
  assert.equal(totalen.vertoningen, 30300);
  assert.equal(totalen.klikken, 300);
  assert.equal(totalen.leads, 10);
});

test("CTR wordt uit de sommen berekend, niet uit het gemiddelde van de rijen", () => {
  const totalen = telOp(kubus, kubus.rijen);
  // Juist: 300 klikken / 30.300 vertoningen = 0,99%.
  const juist = waardeVan(statistiek("ctr"), totalen)!;
  assert.ok(Math.abs(juist - 0.9901) < 0.001, `CTR was ${juist}`);

  // Het gemiddelde van de rij-CTR's zou (1 + 50 + 0,5 + 25) / 4 = 19,1% zijn — bijna
  // twintig keer te hoog, omdat twee rijen met honderd vertoningen dan even zwaar wegen
  // als twee met tienduizend. Precies de fout die deze opzet moet uitsluiten.
  assert.ok(juist < 2, "CTR mag niet richting het rijgemiddelde lopen");
});

test("kosten per lead deelt uitgaven door leads, niet andersom", () => {
  const totalen = telOp(kubus, kubus.rijen);
  assert.equal(waardeVan(statistiek("cpl"), totalen), 33);
});

test("delen door nul geeft een lege cel, geen oneindig", () => {
  const totalen = { uitgaven: 50, vertoningen: 0, klikken: 0, leads: 0 };
  assert.equal(waardeVan(statistiek("ctr"), totalen), null);
  assert.equal(waardeVan(statistiek("cpc"), totalen), null);
  assert.equal(waardeVan(statistiek("cpl"), totalen), null);
});

test("een ontbrekende statistiek geeft null in plaats van undefined", () => {
  assert.equal(waardeVan(statistiek("conversiewaarde"), { uitgaven: 1 }), null);
});

test("filteren op één dimensie houdt alleen die rijen over", () => {
  const rijen = filter(kubus, { account: ["Udenhout"] });
  assert.equal(rijen.length, 2);
  assert.equal(telOp(kubus, rijen).uitgaven, 300);
});

test("filters op meerdere dimensies werken samen, niet los", () => {
  const rijen = filter(kubus, { account: ["Udenhout"], platform: ["instagram"] });
  assert.equal(rijen.length, 0);
});

test("een lege selectie betekent alles", () => {
  assert.equal(filter(kubus, {}).length, 4);
  assert.equal(filter(kubus, { account: [] }).length, 4);
});

test("filteren op een waarde die niet bestaat levert niets op, niet alles", () => {
  // Anders lijkt een verkeerd gespeld filter te werken terwijl het wordt genegeerd.
  assert.equal(filter(kubus, { account: ["Bestaat Niet"] }).length, 0);
});

test("de filterdropdown toont alleen waarden die in de selectie voorkomen", () => {
  const rijen = filter(kubus, { platform: ["facebook"] });
  assert.deepEqual(beschikbareWaarden(kubus, rijen, "account"), ["Udenhout"]);
});

test("groeperen telt per groep op", () => {
  const groepen = groepeer(kubus, kubus.rijen, "account").sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  assert.deepEqual(
    groepen.map((g) => [g.label, g.totalen.uitgaven]),
    [
      ["Porsche", 30],
      ["Udenhout", 300],
    ],
  );
});

test("ISO-weken: de week loopt van maandag tot zondag", () => {
  // 7 september 2026 is een maandag, 13 september de zondag erna.
  assert.deepEqual(isoWeek("2026-09-07"), { jaar: 2026, week: 37 });
  assert.deepEqual(isoWeek("2026-09-13"), { jaar: 2026, week: 37 });
  assert.deepEqual(isoWeek("2026-09-14"), { jaar: 2026, week: 38 });
});

test("ISO-weken rond de jaarwisseling vallen in het jaar van hun donderdag", () => {
  // 1 januari 2027 is een vrijdag en hoort daarmee nog bij week 53 van 2026.
  assert.deepEqual(isoWeek("2027-01-01"), { jaar: 2026, week: 53 });
  assert.deepEqual(isoWeek("2027-01-04"), { jaar: 2027, week: 1 });
});

test("periodesleutels sorteren chronologisch als tekst", () => {
  const sleutels = ["2026-11-02", "2026-02-09", "2026-12-28"].map((d) =>
    periodeSleutel(d, "week"),
  );
  assert.deepEqual([...sleutels].sort(), sleutels.slice().sort());
  // Week 2 mag niet ná week 10 komen doordat "10" < "2" als tekst.
  assert.ok(periodeSleutel("2026-01-05", "week") < periodeSleutel("2026-03-09", "week"));
});

test("kwartalen worden uit de maand afgeleid", () => {
  assert.equal(periodeSleutel("2026-01-31", "kwartaal"), "2026-K1");
  assert.equal(periodeSleutel("2026-04-01", "kwartaal"), "2026-K2");
  assert.equal(periodeSleutel("2026-12-31", "kwartaal"), "2026-K4");
  assert.equal(periodeLabel("2026-K3", "kwartaal"), "Q3 2026");
});

test("groeperen per periode telt dagen samen tot weken", () => {
  const groepen = groepeerPerPeriode(kubus, kubus.rijen, "week");
  assert.equal(groepen.length, 1);
  assert.equal(groepen[0].totalen.uitgaven, 330);
  assert.equal(groepen[0].label, "wk 37 2026");
});

test("een periode zonder rijen blijft als nul in de reeks staan", () => {
  // Zonder dit springt de lijn over een stilgevallen week heen en lijkt er niets aan de
  // hand; met een nul zie je de val.
  const metGat: Kubus = {
    ...kubus,
    labels: { ...kubus.labels, datum: ["2026-09-07", "2026-09-08", "2026-09-21"] },
    rijen: [
      [0, 0, 0, 100, 10000, 100, 5],
      [2, 0, 0, 50, 5000, 50, 2],
    ],
  };
  const groepen = groepeerPerPeriode(metGat, metGat.rijen, "week");
  assert.deepEqual(
    groepen.map((g) => [g.label, g.totalen.uitgaven]),
    [
      ["wk 37 2026", 100],
      ["wk 38 2026", 0],
      ["wk 39 2026", 50],
    ],
  );
});

test("een korte periode biedt geen kwartaalkorrel aan", () => {
  assert.deepEqual(bruikbareKorrels(kubus), ["dag"]);
});

test("een lange periode biedt week, maand en kwartaal aan", () => {
  const lang: Kubus = { ...kubus, periode: { van: "2026-01-01", tot: "2026-07-19" } };
  assert.deepEqual(bruikbareKorrels(lang), ["week", "maand", "kwartaal"]);
});

test("een weekkubus van de server biedt geen dagkorrel aan", () => {
  // Boven de 120 dagen vat de server al samen tot weken; dag teruggeven zou een
  // preciezere grafiek suggereren dan de data draagt.
  const perWeek: Kubus = {
    ...kubus,
    korrel: "week",
    periode: { van: "2025-09-14", tot: "2026-09-13" },
  };
  assert.ok(!bruikbareKorrels(perWeek).includes("dag"));
});

test("de korrelkeuze volgt de periode en niet het aantal dagen met data", () => {
  // Dit was een echte bug: op de organische pagina bepaalde je postfrequentie welke
  // knoppen aanklikbaar waren. Dertig dagen met maar drie postdagen hoort gewoon week
  // aan te bieden.
  const datums = ["2026-08-16", "2026-08-25", "2026-09-09"];
  const dunbezet: Kubus = {
    ...kubus,
    labels: { ...kubus.labels, datum: datums },
    periode: { van: "2026-08-15", tot: "2026-09-13" },
  };
  assert.deepEqual(bruikbareKorrels(dunbezet), ["dag", "week"]);
});

test("een maand opent per dag en een jaar per maand", () => {
  const maand: Kubus = { ...kubus, periode: { van: "2026-08-15", tot: "2026-09-13" } };
  assert.equal(standaardKorrel(maand, bruikbareKorrels(maand)), "dag");

  const jaar: Kubus = { ...kubus, korrel: "week", periode: { van: "2025-09-14", tot: "2026-09-13" } };
  assert.equal(standaardKorrel(jaar, bruikbareKorrels(jaar)), "maand");
});

test("periodeBereik geeft de eerste en laatste dag van een periodesleutel", () => {
  assert.deepEqual(periodeBereik("2026-09-08", "dag"), { van: "2026-09-08", tot: "2026-09-08" });
  // Week 37 van 2026 loopt van maandag 7 tot en met zondag 13 september.
  assert.deepEqual(periodeBereik("2026-W37", "week"), { van: "2026-09-07", tot: "2026-09-13" });
  assert.deepEqual(periodeBereik("2026-02", "maand"), { van: "2026-02-01", tot: "2026-02-28" });
  assert.deepEqual(periodeBereik("2026-K3", "kwartaal"), { van: "2026-07-01", tot: "2026-09-30" });
});

test("een randweek die maar deels in de periode valt is niet volledig", () => {
  // Een periode die op woensdag begint levert een eerste weekstaaf van vijf dagen op.
  // Zonder deze vlag leest die als een ingezakte week in plaats van als een deelperiode.
  const halveRand: Kubus = {
    dimensies: ["datum"],
    labels: { datum: ["2026-09-09", "2026-09-14"] },
    kolommen: ["uitgaven"],
    rijen: [
      [0, 100],
      [1, 100],
    ],
    korrel: "dag",
    periode: { van: "2026-09-09", tot: "2026-09-14" },
  };
  const weken = groepeerPerPeriode(halveRand, halveRand.rijen, "week");
  assert.deepEqual(
    weken.map((w) => [w.sleutel, w.volledig]),
    [
      ["2026-W37", false],
      ["2026-W38", false],
    ],
  );
});

test("groepeer draagt de laatste datum van elke groep mee", () => {
  const groepen = groepeer(kubus, kubus.rijen, "account");
  const udenhout = groepen.find((g) => g.sleutel === "Udenhout");
  assert.equal(udenhout?.laatsteDatum, "2026-09-08");
});

// ---------------------------------------------------------------------------
// Standen versus stromen
// ---------------------------------------------------------------------------

/**
 * Twee accounts, drie dagen. De volgersstand groeit; de nieuwe volgers per dag zijn een
 * stroom. Wie de stand optelt komt op 3× het publiek uit — precies de fout die op de
 * eerste versie van de accountpagina 2,3 miljoen volgers liet zien.
 */
const standKubus: Kubus = {
  dimensies: ["datum", "account"],
  labels: { datum: ["2026-09-07", "2026-09-08", "2026-09-09"], account: ["Udenhout", "Porsche"] },
  kolommen: ["volgers", "volgers_erbij"],
  rijen: [
    [0, 0, 1000, 5],
    [0, 1, 2000, 10],
    [1, 0, 1005, 5],
    [1, 1, 2010, 10],
    [2, 0, 1010, 5],
    [2, 1, 2020, 10],
  ],
  korrel: "dag",
  periode: { van: "2026-09-07", tot: "2026-09-09" },
  standKolommen: ["volgers"],
  standPer: "account",
};

test("een stand wordt niet over de tijd opgeteld", () => {
  const totalen = telOp(standKubus, standKubus.rijen);
  // De laatste stand van beide accounts samen: 1010 + 2020.
  assert.equal(totalen.volgers, 3030);
  // De stroom eronder telt wél gewoon op: 3 dagen × (5 + 10).
  assert.equal(totalen.volgers_erbij, 45);
});

test("een stand blijft een stand binnen één groep", () => {
  const groepen = groepeer(standKubus, standKubus.rijen, "account");
  const udenhout = groepen.find((g) => g.label === "Udenhout")!;
  assert.equal(udenhout.totalen.volgers, 1010);
  assert.equal(udenhout.totalen.volgers_erbij, 15);
});

test("een stand per periode is de laatste meting in die periode", () => {
  const perDag = groepeerPerPeriode(standKubus, standKubus.rijen, "dag");
  assert.deepEqual(
    perDag.map((g) => g.totalen.volgers),
    [3000, 3015, 3030],
  );
  // Alle drie de dagen vallen in dezelfde ISO-week; dan telt de laatste dag.
  const perWeek = groepeerPerPeriode(standKubus, standKubus.rijen, "week");
  assert.equal(perWeek.length, 1);
  assert.equal(perWeek[0].totalen.volgers, 3030);
  assert.equal(perWeek[0].totalen.volgers_erbij, 45);
});

test("een account zonder meting op de slotdag telt met zijn laatste bekende stand mee", () => {
  // Porsche levert op de laatste dag niets aan. Zou de code de stand op nul zetten voor
  // wie op de slotdag ontbreekt, dan zakte het groepstotaal met tweeduizend. In plaats
  // daarvan telt Porsche mee met zijn laatste meting (2010, van dag twee) naast de
  // actuele stand van Udenhout (1010).
  const metGat: Kubus = {
    ...standKubus,
    rijen: standKubus.rijen.filter((r) => !(r[0] === 2 && r[1] === 1)),
  };
  assert.equal(telOp(metGat, metGat.rijen).volgers, 3020);
});

test("zonder standKolommen telt alles gewoon op", () => {
  const zonder: Kubus = { ...standKubus, standKolommen: undefined, standPer: undefined };
  assert.equal(telOp(zonder, zonder.rijen).volgers, 9045);
});
