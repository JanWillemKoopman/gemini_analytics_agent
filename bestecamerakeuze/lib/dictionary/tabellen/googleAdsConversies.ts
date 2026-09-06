import type { TabelBeschrijving } from "@/lib/dictionary/types";

export const googleAdsConversies: TabelBeschrijving = {
  view: "v_ads_conversies",
  doel:
    "Google Ads conversies per conversieactie per dag — bijvoorbeeld ingevulde " +
    "leadformulieren, telefoontjes of andere doelen die in Google Ads zijn ingesteld. " +
    "Gebruik dit voor vragen over wélk type conversie een campagne oplevert, los van kosten.",
  granulariteit:
    "Eén rij = één conversieactie binnen één campagne op één dag, voor één klantaccount.",
  bron: "Google Ads API, rechtstreeks (geen tussenliggend sheet)",
  ververst: "elke nacht om 02:15, laatste 90 dagen worden elke keer volledig vervangen",
  eigenaar: "marketing",

  kolommen: [
    { naam: "klant_naam", type: "text", betekenis: "Welk Google Ads-account deze rij is." },
    { naam: "campagne_naam", type: "text", betekenis: "Campagne die de conversie opleverde." },
    {
      naam: "conversieactie_naam",
      type: "text",
      betekenis:
        "Naam van de conversieactie zoals ingesteld in Google Ads, bijvoorbeeld " +
        "'Leadformulier verzonden' of 'Telefoontje vanaf website'.",
    },
    {
      naam: "conversiecategorie",
      type: "text",
      betekenis: "De categorie waarin Google Ads deze conversieactie indeelt.",
      waarden: ["SUBMIT_LEAD_FORM", "PHONE_CALL_LEAD", "PURCHASE", "SIGNUP", "OTHER"],
    },
    { naam: "datum", type: "date", betekenis: "Dag waarop de conversies plaatsvonden." },
    {
      naam: "aantal_conversies",
      type: "numeric",
      betekenis:
        "Aantal conversies van dit type op deze dag, zoals Google Ads het telt " +
        "(kan een fractie zijn door het attributiemodel, dus geen geheel getal).",
    },
    {
      naam: "conversiewaarde",
      type: "numeric",
      betekenis: "Waarde die aan deze conversies is toegekend.",
      eenheid: "euro",
    },
  ],

  regels: [
    "'Conversies' hier is per conversieactie, dus fijnmaziger dan het totaal in v_ads_campagnes (dat is metrics.conversions, hier is het all_conversions per actie) — tel niet zomaar bij elkaar op om het campagnetotaal te reproduceren, want conversieactietypes kunnen overlappen.",
    "Een conversie in deze tabel is niet automatisch een verkocht voertuig uit v_verkopen: het is wat Google Ads als doel herkent (bv. een ingevuld formulier), niet de uiteindelijke verkoopstatus.",
  ],

  synoniemen: {
    lead: "conversieactie_naam met categorie SUBMIT_LEAD_FORM of PHONE_CALL_LEAD",
    aanvraag: "conversieactie_naam met categorie SUBMIT_LEAD_FORM",
  },

  valkuilen: [
    "aantal_conversies is een decimaal getal door het attributiemodel van Google Ads (fractionele toerekening bij meerdere aanrakingen) — rond niet af naar een geheel getal alsof het een simpele telling is.",
  ],

  koppelingen: [
    {
      naarTabel: "v_ads_campagnes",
      via: "v_ads_conversies.campagne_naam = v_ads_campagnes.campagne_naam",
      toelichting: "Om conversies naast de kosten van diezelfde campagne te leggen.",
    },
  ],

  voorbeelden: [
    {
      vraag: "Welke conversieacties leverden de meeste conversies op deze maand?",
      sql:
        "select conversieactie_naam, sum(aantal_conversies) as conversies\n" +
        "from v_ads_conversies\n" +
        "where date_trunc('month', datum) = date_trunc('month', current_date)\n" +
        "group by conversieactie_naam\n" +
        "order by conversies desc",
    },
    {
      vraag: "Hoeveel leadformulieren kwamen er per campagne binnen afgelopen 30 dagen?",
      sql:
        "select campagne_naam, sum(aantal_conversies) as leads\n" +
        "from v_ads_conversies\n" +
        "where conversiecategorie = 'SUBMIT_LEAD_FORM'\n" +
        "  and datum >= current_date - interval '30 days'\n" +
        "group by campagne_naam\n" +
        "order by leads desc",
    },
  ],
};
