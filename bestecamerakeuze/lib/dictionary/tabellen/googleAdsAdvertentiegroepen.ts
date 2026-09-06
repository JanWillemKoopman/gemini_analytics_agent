import type { TabelBeschrijving } from "@/lib/dictionary/types";

export const googleAdsAdvertentiegroepen: TabelBeschrijving = {
  view: "v_ads_advertentiegroepen",
  doel:
    "Google Ads prestaties per advertentiegroep per dag — de laag tussen campagne en " +
    "zoekwoord. Gebruik dit voor vragen die specifieker zijn dan de hele campagne maar " +
    "niet tot op zoekwoordniveau hoeven.",
  granulariteit: "Eén rij = één advertentiegroep op één dag, voor één klantaccount.",
  bron: "Google Ads API, rechtstreeks (geen tussenliggend sheet)",
  ververst: "elke nacht om 02:15, laatste 90 dagen worden elke keer volledig vervangen",
  eigenaar: "marketing",

  kolommen: [
    { naam: "klant_naam", type: "text", betekenis: "Welk Google Ads-account deze rij is." },
    { naam: "campagne_naam", type: "text", betekenis: "Campagne waar deze advertentiegroep onder valt." },
    { naam: "advertentiegroep_naam", type: "text", betekenis: "Naam van de advertentiegroep." },
    {
      naam: "status",
      type: "text",
      betekenis: "Status van de advertentiegroep in Google Ads.",
      waarden: ["ENABLED", "PAUSED", "REMOVED"],
    },
    { naam: "datum", type: "date", betekenis: "Dag waarop de metrics zijn gemeten." },
    { naam: "kosten", type: "numeric", betekenis: "Advertentie-uitgave op deze dag voor deze advertentiegroep.", eenheid: "euro" },
    { naam: "kliks", type: "int", betekenis: "Aantal kliks.", eenheid: "stuks" },
    { naam: "vertoningen", type: "int", betekenis: "Aantal vertoningen.", eenheid: "stuks" },
    {
      naam: "conversies",
      type: "numeric",
      betekenis: "Aantal conversies zoals Google Ads ze telt voor deze advertentiegroep.",
    },
    {
      naam: "conversiewaarde",
      type: "numeric",
      betekenis: "Waarde die aan die conversies is toegekend.",
      eenheid: "euro",
    },
  ],

  regels: [
    "Kosten, kliks, vertoningen en conversies mag je optellen over dagen/advertentiegroepen.",
    "Voor de meeste vragen ('welke campagne presteert het best') is v_ads_campagnes het juiste startpunt — pak deze tabel pas als er expliciet naar het niveau onder de campagne gevraagd wordt.",
  ],

  synoniemen: {
    "ad group": "advertentiegroep",
    adgroep: "advertentiegroep_naam",
  },

  valkuilen: [
    "Dezelfde advertentiegroepnaam kan in meerdere campagnes voorkomen — groepeer op de combinatie van campagne_naam en advertentiegroep_naam, niet op advertentiegroep_naam alleen.",
  ],

  koppelingen: [
    {
      naarTabel: "v_ads_zoekwoorden",
      via:
        "v_ads_advertentiegroepen.campagne_naam = v_ads_zoekwoorden.campagne_naam " +
        "and v_ads_advertentiegroepen.advertentiegroep_naam = v_ads_zoekwoorden.advertentiegroep_naam",
      toelichting: "Om van een opvallende advertentiegroep in te zoomen op de onderliggende zoekwoorden.",
    },
  ],

  voorbeelden: [
    {
      vraag: "Welke advertentiegroepen binnen campagne X kosten het meest?",
      sql:
        "select advertentiegroep_naam, sum(kosten) as kosten, sum(conversies) as conversies\n" +
        "from v_ads_advertentiegroepen\n" +
        "where campagne_naam = 'X'\n" +
        "  and datum >= current_date - interval '30 days'\n" +
        "group by advertentiegroep_naam\n" +
        "order by kosten desc",
    },
  ],
};
