import type { TabelBeschrijving } from "@/lib/dictionary/types";

export const googleAdsCampagnes: TabelBeschrijving = {
  view: "v_ads_campagnes",
  doel:
    "Google Ads campagneprestaties per dag: kosten, kliks, vertoningen en conversies. " +
    "Gebruik deze tabel voor vragen over advertentiebudget, bereik en klikgedrag per campagne.",
  granulariteit:
    "Eén rij = één campagne op één dag, voor één klantaccount. Sommeer over de datums " +
    "voor een periode; sommeer nooit ctr of cpc, herbereken die na de sum().",
  bron: "Google Ads API, rechtstreeks (geen tussenliggend sheet)",
  ververst: "elke nacht om 02:15, laatste 90 dagen worden elke keer volledig vervangen",
  eigenaar: "marketing",

  kolommen: [
    {
      naam: "klant_naam",
      type: "text",
      betekenis:
        "Welk Google Ads-account (klantaccount onder het manager-account) deze rij is. " +
        "Gebruik dit om per merk/vestiging te filteren als er meerdere accounts zijn.",
    },
    {
      naam: "campagne_naam",
      type: "text",
      betekenis: "Naam van de campagne, zoals ingesteld in Google Ads.",
    },
    {
      naam: "status",
      type: "text",
      betekenis: "Status van de campagne in Google Ads.",
      waarden: ["ENABLED", "PAUSED", "REMOVED"],
    },
    {
      naam: "datum",
      type: "date",
      betekenis: "Dag waarop de metrics zijn gemeten.",
    },
    {
      naam: "kosten",
      type: "numeric",
      betekenis: "Advertentie-uitgave op deze dag voor deze campagne.",
      eenheid: "euro",
    },
    { naam: "kliks", type: "int", betekenis: "Aantal kliks op advertenties van deze campagne.", eenheid: "stuks" },
    {
      naam: "vertoningen",
      type: "int",
      betekenis: "Aantal keer dat een advertentie van deze campagne getoond is.",
      eenheid: "stuks",
    },
    {
      naam: "conversies",
      type: "numeric",
      betekenis:
        "Aantal conversies zoals Google Ads ze telt voor deze campagne (attributiemodel " +
        "van Google Ads, niet per se hetzelfde als een verkochte order).",
    },
    {
      naam: "conversiewaarde",
      type: "numeric",
      betekenis: "Waarde die aan die conversies is toegekend, zoals ingesteld in Google Ads.",
      eenheid: "euro",
    },
    {
      naam: "ctr",
      type: "numeric",
      betekenis: "Doorkliksratio: kliks gedeeld door vertoningen, al berekend in de view.",
      leegBetekent: "geen vertoningen op deze rij",
    },
    {
      naam: "cpc",
      type: "numeric",
      betekenis: "Gemiddelde kosten per klik, al berekend in de view.",
      eenheid: "euro",
      leegBetekent: "geen kliks op deze rij",
    },
  ],

  regels: [
    "Kosten, kliks en vertoningen mag je optellen over meerdere dagen/campagnes; ctr en cpc niet — herbereken die achteraf uit de opgetelde kosten/kliks/vertoningen.",
    "'Conversies' is het aantal zoals Google Ads het telt op basis van het ingestelde attributiemodel. Dit is niet automatisch hetzelfde als een 'verkocht voertuig' uit v_verkopen — er is geen technische koppeling tussen beide tabellen.",
    "Alleen de laatste 90 dagen zijn beschikbaar; oudere data is niet bewaard.",
  ],

  synoniemen: {
    spend: "kosten",
    budget: "kosten",
    impressies: "vertoningen",
    clicks: "kliks",
  },

  valkuilen: [
    "Campagnenamen komen niet automatisch overeen met merken/campagnes uit v_verkopen — een koppeling moet op tekstgelijkenis van de naam en met voorzichtigheid, nooit blind.",
    "Een gepauzeerde of verwijderde campagne (status PAUSED/REMOVED) kan nog steeds historische rijen hebben in de laatste 90 dagen.",
  ],

  voorbeelden: [
    {
      vraag: "Wat waren de advertentiekosten per campagne afgelopen 30 dagen?",
      sql:
        "select campagne_naam, sum(kosten) as kosten, sum(kliks) as kliks\n" +
        "from v_ads_campagnes\n" +
        "where datum >= current_date - interval '30 days'\n" +
        "group by campagne_naam\n" +
        "order by kosten desc",
    },
    {
      vraag: "Wat is de gemiddelde CPC per campagne deze maand?",
      sql:
        "select campagne_naam,\n" +
        "       sum(kosten) as kosten,\n" +
        "       sum(kliks) as kliks,\n" +
        "       round(sum(kosten) / nullif(sum(kliks), 0), 2) as gemiddelde_cpc\n" +
        "from v_ads_campagnes\n" +
        "where date_trunc('month', datum) = date_trunc('month', current_date)\n" +
        "group by campagne_naam\n" +
        "order by gemiddelde_cpc desc",
      toelichting:
        "CPC nooit rechtstreeks middelen over rijen — eerst kosten en kliks optellen, dan pas delen.",
    },
  ],
};
