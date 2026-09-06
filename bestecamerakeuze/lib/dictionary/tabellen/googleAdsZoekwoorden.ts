import type { TabelBeschrijving } from "@/lib/dictionary/types";

export const googleAdsZoekwoorden: TabelBeschrijving = {
  view: "v_ads_zoekwoorden",
  doel:
    "Google Ads zoekwoordprestaties per dag: welke zoekwoorden kliks en kosten genereren, " +
    "en hoe goed ze scoren (kwaliteitsscore).",
  granulariteit:
    "Eén rij = één zoekwoord binnen één advertentiegroep op één dag, voor één klantaccount.",
  bron: "Google Ads API, rechtstreeks (geen tussenliggend sheet)",
  ververst: "elke nacht om 02:15, laatste 90 dagen worden elke keer volledig vervangen",
  eigenaar: "marketing",

  kolommen: [
    { naam: "klant_naam", type: "text", betekenis: "Welk Google Ads-account deze rij is." },
    { naam: "campagne_naam", type: "text", betekenis: "Campagne waar dit zoekwoord onder valt." },
    {
      naam: "advertentiegroep_naam",
      type: "text",
      betekenis: "Advertentiegroep binnen de campagne waar dit zoekwoord onder valt.",
    },
    { naam: "zoekwoord_tekst", type: "text", betekenis: "Het zoekwoord zoals ingesteld in Google Ads." },
    {
      naam: "zoekwoord_matchtype",
      type: "text",
      betekenis: "Het matchtype van het zoekwoord — bepaalt hoe strikt een zoekopdracht moet matchen.",
      waarden: ["EXACT", "PHRASE", "BROAD"],
    },
    {
      naam: "kwaliteitsscore",
      type: "int",
      betekenis: "Google's kwaliteitsscore voor dit zoekwoord, van 1 (slecht) tot 10 (uitstekend).",
      leegBetekent: "nog niet genoeg data voor Google om een score te berekenen",
    },
    { naam: "datum", type: "date", betekenis: "Dag waarop de metrics zijn gemeten." },
    { naam: "kosten", type: "numeric", betekenis: "Advertentie-uitgave op dit zoekwoord op deze dag.", eenheid: "euro" },
    { naam: "kliks", type: "int", betekenis: "Aantal kliks op advertenties die door dit zoekwoord getriggerd zijn.", eenheid: "stuks" },
    { naam: "vertoningen", type: "int", betekenis: "Aantal keer dat dit zoekwoord tot een vertoning leidde.", eenheid: "stuks" },
    {
      naam: "ctr",
      type: "numeric",
      betekenis: "Doorkliksratio: kliks gedeeld door vertoningen, al berekend in de view.",
      leegBetekent: "geen vertoningen op deze rij",
    },
  ],

  regels: [
    "Kosten, kliks en vertoningen mag je optellen; ctr niet — herbereken die na de sum().",
    "Kwaliteitsscore mag je nooit sommeren of optellen over rijen — dat is een gemiddelde/index per zoekwoord, geen aantal. Gebruik avg() als je een gemiddelde over meerdere zoekwoorden wilt, en wees je ervan bewust dat dit een grove indicatie is.",
    "Een laag kwaliteitsscore (1-4) samen met hoge kosten wijst op een zoekwoord dat duur is per klik en een kandidaat om te pauzeren of te herzien.",
  ],

  synoniemen: {
    keyword: "zoekwoord_tekst",
    "search term": "zoekwoord_tekst",
    qualityscore: "kwaliteitsscore",
  },

  valkuilen: [
    "Hetzelfde zoekwoord kan in meerdere advertentiegroepen of campagnes voorkomen — groepeer op de combinatie van campagne, advertentiegroep én zoekwoord, niet op het zoekwoord alleen, tenzij expliciet gevraagd.",
  ],

  koppelingen: [
    {
      naarTabel: "v_ads_campagnes",
      via: "v_ads_zoekwoorden.campagne_naam = v_ads_campagnes.campagne_naam",
      toelichting: "Om zoekwoordprestaties in de context van het totale campagnebudget te zien.",
    },
  ],

  voorbeelden: [
    {
      vraag: "Welke zoekwoorden kosten het meest zonder veel kliks op te leveren?",
      sql:
        "select campagne_naam, advertentiegroep_naam, zoekwoord_tekst,\n" +
        "       sum(kosten) as kosten, sum(kliks) as kliks\n" +
        "from v_ads_zoekwoorden\n" +
        "where datum >= current_date - interval '30 days'\n" +
        "group by campagne_naam, advertentiegroep_naam, zoekwoord_tekst\n" +
        "having sum(kliks) < 5\n" +
        "order by kosten desc\n" +
        "limit 20",
    },
    {
      vraag: "Wat is de gemiddelde kwaliteitsscore per campagne?",
      sql:
        "select campagne_naam, round(avg(kwaliteitsscore), 1) as gemiddelde_kwaliteitsscore\n" +
        "from v_ads_zoekwoorden\n" +
        "where datum = current_date - interval '1 day'\n" +
        "  and kwaliteitsscore is not null\n" +
        "group by campagne_naam\n" +
        "order by gemiddelde_kwaliteitsscore asc",
      toelichting:
        "Kwaliteitsscore verandert nauwelijks per dag; één representatieve dag pakken voorkomt dat drukke zoekwoorden te zwaar meewegen.",
    },
  ],
};
