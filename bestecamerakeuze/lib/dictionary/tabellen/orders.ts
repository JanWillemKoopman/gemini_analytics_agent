import type { TabelBeschrijving } from "@/lib/dictionary/types";

/** Bron: Google Sheet-tabblad "Data orders 2" (zelfde spreadsheet als de Campagnes-tab). */
export const orders: TabelBeschrijving = {
  view: "v_orders",
  doel:
    "Alle verkochte voertuigen. Gebruik deze tabel voor vragen over aantallen verkocht, " +
    "verkoop per merk/model, nieuw versus gebruikt, en welk deel van de orders uit een " +
    "campagne komt.",
  granulariteit:
    "Eén rij = één order. Let op: de kolom `aantal` kan in theorie groter zijn dan 1 " +
    "(meerdere voertuigen op één orderregel), dus tel voertuigen met sum(aantal) en " +
    "niet met count(*) — in de praktijk staat hij vrijwel altijd op 1.",
  bron: "Google Sheet (zelfde als Campagnes-tab), tabblad 'Data orders 2'",
  ververst: "elke nacht om 03:00",
  eigenaar: "verkoop binnendienst",

  kolommen: [
    {
      naam: "ordersoort",
      type: "text",
      betekenis: "Of het een nieuwe of gebruikte auto betreft.",
      waarden: ["Nieuw", "Gebruikt"],
    },
    {
      naam: "merk",
      type: "text",
      betekenis: "Merk van het verkochte voertuig.",
      leegBetekent: "niet geregistreerd",
    },
    {
      naam: "model",
      type: "text",
      betekenis: "Model van het verkochte voertuig, zoals genoteerd in het bronsysteem (kan een modelcode of -variant bevatten).",
      leegBetekent: "niet geregistreerd — komt voor bij circa een kwart van de orders",
    },
    {
      naam: "aantal",
      type: "int",
      betekenis: "Aantal voertuigen op deze orderregel.",
      eenheid: "stuks",
    },
    {
      naam: "aangelegd",
      type: "date",
      betekenis: "Datum waarop de order is aangelegd. Gebruik deze kolom voor alle vragen over 'wanneer verkocht'.",
    },
    {
      naam: "campagne",
      type: "text",
      betekenis:
        "Naam van de campagne waaraan deze order is toegeschreven, exact zoals de " +
        "campagnenaam op de Campagnes-tab. Het merendeel van de orders (circa 75%) " +
        "heeft geen campagne (organische verkoop).",
      leegBetekent: "niet aan een campagne toegeschreven (organisch)",
    },
  ],

  regels: [
    "Tel voertuigen altijd met sum(aantal), nooit met count(*), ook al staat aantal " +
      "vrijwel altijd op 1.",
    "Deze tabel bevat geen prijzen of omzetbedragen — vraagt iemand naar omzet of " +
      "orderwaarde, zeg dan dat dat gegeven hier niet beschikbaar is.",
  ],

  valkuilen: [
    "v_leads (het andere tabblad) heeft geen order-ID of ander gedeeld veld met deze " +
      "tabel — join ze niet op merk/model/datum, dat levert willekeurige matches op. " +
      "Beide views zijn losse extracten uit dezelfde spreadsheet, geen relationele koppeling.",
    "Meerdere orders kunnen identiek zijn in alle kolommen (zelfde merk, model, datum, " +
      "geen campagne) zonder dat het dubbeltellingen zijn — er is geen order-ID om dat " +
      "aan te tonen, dus behandel gelijke rijen als afzonderlijke, echte orders.",
  ],

  voorbeelden: [
    {
      vraag: "Hoeveel nieuwe Volkswagens zijn er in Q1 2026 verkocht?",
      sql:
        "select sum(aantal) as aantal_verkocht\n" +
        "from v_orders\n" +
        "where merk = 'Volkswagen'\n" +
        "  and ordersoort = 'Nieuw'\n" +
        "  and aangelegd >= date '2026-01-01'\n" +
        "  and aangelegd <  date '2026-04-01'",
    },
    {
      vraag: "Welk deel van de orders komt uit een campagne?",
      sql:
        "select\n" +
        "  count(*) filter (where campagne is not null) as orders_met_campagne,\n" +
        "  count(*) as totaal_orders,\n" +
        "  round(100.0 * count(*) filter (where campagne is not null) / count(*), 1) as aandeel_pct\n" +
        "from v_orders",
    },
    {
      vraag: "Hoeveel gebruikte auto's zijn er per merk verkocht, afgelopen maand?",
      sql:
        "select merk, sum(aantal) as aantal_verkocht\n" +
        "from v_orders\n" +
        "where ordersoort = 'Gebruikt'\n" +
        "  and aangelegd >= date_trunc('month', current_date) - interval '1 month'\n" +
        "  and aangelegd <  date_trunc('month', current_date)\n" +
        "group by merk\n" +
        "order by aantal_verkocht desc",
    },
  ],
};
