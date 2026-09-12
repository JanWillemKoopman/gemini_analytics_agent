import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canoniekeAccountnamen,
  dagenTussen,
  deel,
  telMetingen,
  verwerkAdvertenties,
  verwerkOrganisch,
} from "./windsor.ts";

// Twee dagen, twee accounts, drie campagnes — de vorm die de `facebook`-connector
// oplevert (één rij per dag per campagne).
const ADVERTENTIE_RIJEN = [
  {
    date: "2026-09-01",
    account_name: "Van den Udenhout",
    campaign: "Leads_najaar",
    objective: "OUTCOME_LEADS",
    impressions: 1000,
    reach: 800,
    clicks: 50,
    link_clicks: 40,
    spend: 25,
    actions_lead: 5,
    actions_post_engagement: 60,
  },
  {
    date: "2026-09-02",
    account_name: "Van den Udenhout",
    campaign: "Leads_najaar",
    objective: "OUTCOME_LEADS",
    impressions: 2000,
    reach: 1500,
    clicks: 100,
    link_clicks: 90,
    spend: 50,
    actions_lead: 3,
    actions_post_engagement: 120,
  },
  {
    date: "2026-09-02",
    account_name: "Van den Udenhout",
    campaign: "Traffic_occasions",
    objective: "LINK_CLICKS",
    impressions: 500,
    reach: 450,
    clicks: 20,
    link_clicks: 15,
    spend: 10,
    actions_lead: null,
    actions_post_engagement: null,
  },
  {
    date: "2026-09-02",
    account_name: "Bentley Maastricht",
    campaign: "Branding",
    objective: "OUTCOME_AWARENESS",
    impressions: 300,
    reach: 290,
    clicks: 4,
    link_clicks: null,
    spend: 7.5,
    actions_lead: null,
    actions_post_engagement: 9,
  },
];

test("advertentierijen worden per dag per account opgeteld", () => {
  const { perDagPerAccount } = verwerkAdvertenties(ADVERTENTIE_RIJEN);

  assert.equal(perDagPerAccount.length, 3);
  const tweedeSep = perDagPerAccount.find(
    (d) => d.datum === "2026-09-02" && d.account === "Van den Udenhout",
  );
  // De twee campagnes van die dag horen in één dagcijfer te vallen.
  assert.equal(tweedeSep?.uitgaven, 60);
  assert.equal(tweedeSep?.weergaven, 2500);
  assert.equal(tweedeSep?.clicks, 120);
});

test("advertentierijen worden per campagne opgeteld, gesorteerd op uitgaven", () => {
  const { campagnes } = verwerkAdvertenties(ADVERTENTIE_RIJEN);

  assert.deepEqual(
    campagnes.map((c) => c.campagne),
    ["Leads_najaar", "Traffic_occasions", "Branding"],
  );
  const leads = campagnes[0];
  assert.equal(leads.uitgaven, 75);
  assert.equal(leads.weergaven, 3000);
  assert.equal(leads.leads, 8);
  assert.equal(leads.doel, "OUTCOME_LEADS");
});

test("een lege cel telt als nul en niet als NaN", () => {
  const { campagnes } = verwerkAdvertenties(ADVERTENTIE_RIJEN);
  const branding = campagnes.find((c) => c.campagne === "Branding");

  assert.equal(branding?.websiteClicks, 0);
  assert.equal(branding?.leads, 0);
});

test("dezelfde campagnenaam bij twee accounts blijft twee campagnes", () => {
  const { campagnes } = verwerkAdvertenties([
    { ...ADVERTENTIE_RIJEN[0], account_name: "A" },
    { ...ADVERTENTIE_RIJEN[0], account_name: "B" },
  ]);

  assert.equal(campagnes.length, 2);
});

test("telMetingen levert hetzelfde totaal als de som van de dagen", () => {
  const { perDagPerAccount, campagnes } = verwerkAdvertenties(ADVERTENTIE_RIJEN);

  // Het accountfilter op de pagina rekent de totalen zelf uit met telMetingen; dat mag
  // nooit een ander getal geven dan de campagnekant van dezelfde rijen.
  assert.deepEqual(telMetingen(perDagPerAccount), telMetingen(campagnes));
});

test("verhoudingsgetallen worden ná het optellen berekend, niet gemiddeld", () => {
  const { campagnes } = verwerkAdvertenties(ADVERTENTIE_RIJEN);
  const leads = campagnes[0];

  // Dag 1 heeft een CTR van 5%, dag 2 van 5% — hier gelijk, maar de CPC loopt uiteen
  // (€ 0,50 tegen € 0,50) en de kosten per lead niet (€ 5 tegen € 16,67). Het
  // periodecijfer is de som gedeeld door de som: 75 / 8.
  assert.equal(deel(leads.uitgaven, leads.leads), 9.375);
  assert.equal(deel(leads.clicks, leads.weergaven), 0.05);
});

test("deel geeft null in plaats van NaN of Infinity", () => {
  assert.equal(deel(5, 0), null);
  assert.equal(deel(0, 0), null);
  assert.equal(deel(Number.NaN, 2), null);
  assert.equal(deel(0, 10), 0);
});

test("dagenTussen vult elke dag in de periode, grenzen inbegrepen", () => {
  assert.deepEqual(dagenTussen("2026-09-01", "2026-09-03"), [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
  ]);
  assert.deepEqual(dagenTussen("2026-09-01", "2026-09-01"), ["2026-09-01"]);
  // Over een maandgrens en over de zomertijdgrens (26 oktober 2026) heen.
  assert.equal(dagenTussen("2026-10-24", "2026-10-28").length, 5);
});

// De organische feed mengt paginadagen en berichten: een rij met post_id is een
// bericht (paginavelden op 0), een rij zonder post_id is de dagstand van de pagina.
const ORGANISCHE_RIJEN = [
  {
    date: "2026-09-01",
    account_name: "Van den Udenhout",
    post_id: null,
    page_fans: 13_100,
    page_daily_follows: 4,
    page_impressions: 30_000,
    page_impressions_organic: 2_000,
    page_post_engagements: 500,
  },
  {
    date: "2026-09-01",
    account_name: "Van den Udenhout",
    post_id: "135654409827841_1",
    post_created_time: "2026-09-01T08:49:00+0000",
    post_message_oneline: "Bericht over bedrijfswagens",
    permalink_url: "https://www.facebook.com/135654409827841/posts/1",
    type: "photo",
    post_impressions: 9_000,
    post_impressions_unique: 7_000,
    post_reactions_total: 24,
    post_comments_total: 1,
    post_clicks: 182,
    post_video_views: 0,
    // Op een berichtrij staan de paginavelden op nul — die mogen niet meetellen.
    page_fans: 0,
    page_daily_follows: 0,
    page_impressions: 0,
    page_impressions_organic: 0,
    page_post_engagements: 0,
  },
  {
    date: "2026-09-02",
    account_name: "Van den Udenhout",
    post_id: null,
    page_fans: 13_110,
    page_daily_follows: 10,
    page_impressions: 20_000,
    page_impressions_organic: 1_500,
    page_post_engagements: 400,
  },
  {
    date: "2026-09-02",
    account_name: "VELOO",
    post_id: null,
    page_fans: 181,
    page_daily_follows: 0,
    page_impressions: 6_000,
    page_impressions_organic: 6_000,
    page_post_engagements: 100,
  },
];

test("volgers zijn de laatste stand, niet de som van de dagen", () => {
  const { paginas } = verwerkOrganisch(ORGANISCHE_RIJEN);
  const udenhout = paginas.find((p) => p.account === "Van den Udenhout");

  assert.equal(udenhout?.volgers, 13_110);
  assert.equal(udenhout?.volgersErbij, 14);
});

test("paginaweergaven tellen alleen de paginarijen, niet de berichtrijen", () => {
  const { paginas } = verwerkOrganisch(ORGANISCHE_RIJEN);
  const udenhout = paginas.find((p) => p.account === "Van den Udenhout");

  assert.equal(udenhout?.weergaven, 50_000);
  assert.equal(udenhout?.organischeWeergaven, 3_500);
  assert.equal(udenhout?.interacties, 900);
  assert.equal(udenhout?.berichten, 1);
});

test("berichten komen los uit de feed, met de plaatsingsdatum en de link", () => {
  const { berichten } = verwerkOrganisch(ORGANISCHE_RIJEN);

  assert.equal(berichten.length, 1);
  assert.equal(berichten[0].datum, "2026-09-01");
  assert.equal(berichten[0].weergaven, 9_000);
  assert.equal(berichten[0].url, "https://www.facebook.com/135654409827841/posts/1");
  assert.equal(berichten[0].soort, "photo");
});

test("een bericht dat op twee dagen terugkomt telt één keer", () => {
  const bericht = ORGANISCHE_RIJEN[1];
  const { berichten, paginas } = verwerkOrganisch([
    bericht,
    { ...bericht, date: "2026-09-02" },
  ]);

  assert.equal(berichten.length, 1);
  assert.equal(berichten[0].weergaven, 9_000);
  assert.equal(paginas[0].berichten, 1);
});

test("pagina's zonder volgerscijfer houden null in plaats van nul", () => {
  const { paginas } = verwerkOrganisch([
    { date: "2026-09-01", account_name: "Nieuwe pagina", post_id: null, page_fans: null },
  ]);

  assert.equal(paginas[0].volgers, null);
});

// Meta schrijft dezelfde vestiging in het advertentieaccount anders dan op de pagina;
// zonder normalisatie worden dat twee regels in het accountfilter.
test("de nettere schrijfwijze wint bij twee varianten van dezelfde naam", () => {
  const namen = canoniekeAccountnamen([
    "Veloo",
    "VELOO",
    "Porsche centrum Maastricht",
    "Porsche Centrum Maastricht",
    "Van den Udenhout",
  ]);

  assert.equal(namen.get("veloo"), "Veloo");
  assert.equal(namen.get("porsche centrum maastricht"), "Porsche Centrum Maastricht");
  assert.equal(namen.get("van den udenhout"), "Van den Udenhout");
  assert.equal(namen.size, 3);
});

test("de gekozen schrijfwijze hangt niet af van de rijvolgorde", () => {
  const eerst = canoniekeAccountnamen(["VELOO", "Veloo"]);
  const andersom = canoniekeAccountnamen(["Veloo", "VELOO"]);

  assert.equal(eerst.get("veloo"), andersom.get("veloo"));
});

test("dubbele spaties en witruimte leiden niet tot een tweede account", () => {
  const namen = canoniekeAccountnamen(["Van den  Udenhout", " Van den Udenhout "]);

  assert.equal(namen.size, 1);
});

test("advertenties en pagina's vallen onder één accountnaam", () => {
  const naamVoor = (ruw: string) => (ruw.toLowerCase() === "veloo" ? "Veloo" : ruw);
  const { campagnes } = verwerkAdvertenties(
    [{ ...ADVERTENTIE_RIJEN[0], account_name: "VELOO" }],
    naamVoor,
  );
  const { paginas } = verwerkOrganisch(
    [{ ...ORGANISCHE_RIJEN[0], account_name: "Veloo" }],
    naamVoor,
  );

  assert.equal(campagnes[0].account, "Veloo");
  assert.equal(paginas[0].account, "Veloo");
});
