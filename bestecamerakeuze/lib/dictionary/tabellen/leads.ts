import type { TabelBeschrijving } from "@/lib/dictionary/types";

/**
 * Bron: Google Sheet-tabblad "Data leads" (zelfde spreadsheet als de Campagnes-tab).
 *
 * De ruwe sheet bevat naast leadgegevens ook campagnecijfers (Budget, Uitgaven, Doel
 * leads/orders, Start/Eind, Status, Orders totaal, Order_campagne, Alles, Campagne alle
 * leads) die via een lookup op de campagnenaam op elke leadregel herhaald staan. Die zijn
 * bewust niet meegenomen in v_leads: het zijn campagnecijfers, geen leadgegevens, en ze
 * per lead optellen zou het campagnebudget zoveel keer meetellen als er leads voor die
 * campagne zijn. Wil je iets over een campagne zelf weten (budget, uitgaven, doelen),
 * dan hoort dat bij de Campagnes-tab — nog geen aparte tabel hier in het dataloket.
 *
 * De ruwe sheet bevat ook tienduizenden volledig lege paddingrijen (geen kanaal, merk of
 * datum). Die worden bij het inlezen al geweerd (zie vereisteKolom in lib/sync/bronnen.ts).
 */
export const leads: TabelBeschrijving = {
  view: "v_leads",
  doel:
    "Alle individuele leads: elke rij is één keer dat iemand interesse toonde (via de " +
    "website, showroom, telefoon, mail, of een externe partij). Gebruik deze tabel voor " +
    "vragen over aantallen leads, herkomst (kanaal), merk/model-interesse, sluitredenen " +
    "en de conversie van lead naar order.",
  granulariteit: "Eén rij = één lead.",
  bron: "Google Sheet (zelfde als Campagnes-tab), tabblad 'Data leads'",
  ververst: "elke nacht om 03:00",
  eigenaar: "marketing",

  kolommen: [
    {
      naam: "kanaal",
      type: "text",
      betekenis:
        "Specifieke herkomst van de lead, bijvoorbeeld 'Udenhout.nl', 'Showroom', " +
        "'CST', 'Autotrack.nl'. Vrije tekst met veel verschillende waarden (ruim 60) — " +
        "gebruik ilike voor een zoekterm, niet een exacte match, tenzij de gebruiker een " +
        "exacte kanaalnaam noemt.",
    },
    {
      naam: "kanaalgroep",
      type: "text",
      betekenis: "Bredere categorie waar kanaal onder valt. Gebruik dit voor een overzicht per hoofdgroep.",
      waarden: ["Showroom", "Internet", "Acquisitie", "Mail", "Telefoon"],
    },
    {
      naam: "ordersoort",
      type: "text",
      betekenis: "Of de interesse een nieuwe of gebruikte auto betreft.",
      waarden: ["Nieuw", "Gebruikt"],
      leegBetekent: "niet geregistreerd",
    },
    {
      naam: "onderwerp",
      type: "text",
      betekenis:
        "Vrije tekst: titel/omschrijving van de lead zoals die in het bronsysteem " +
        "stond. Niet geschikt om op te filteren of te groeperen — leesbaar in een " +
        "tabelweergave, niet bruikbaar in where/group by.",
      leegBetekent: "geen omschrijving beschikbaar",
    },
    {
      naam: "merk",
      type: "text",
      betekenis:
        "Merk waar de lead over gaat. Udenhout verkoopt zelf Volkswagen, Škoda, Audi, " +
        "Volkswagen Bedrijfswagens, SEAT en CUPRA; incidenteel komt een ander merk voor " +
        "(bijvoorbeeld een proefrit- of inruilaanvraag die niet zuiver geregistreerd is).",
      waarden: ["Volkswagen", "Škoda", "Audi", "Volkswagen Bedrijfswagens", "SEAT", "CUPRA"],
      leegBetekent: "niet geregistreerd",
    },
    {
      naam: "model",
      type: "text",
      betekenis: "Model waar de lead over gaat, zoals genoteerd in het bronsysteem (kan een modelcode of -variant bevatten).",
      leegBetekent: "niet geregistreerd",
    },
    {
      naam: "sluitreden",
      type: "text",
      betekenis:
        "Waarom een lead is afgesloten. Een gevulde sluitreden betekent dat de lead " +
        "niet meer open staat — 'Gekocht' is de enige sluitreden die een succesvolle " +
        "afsluiting is; alle andere zijn een verloren of neutrale reden (klant koos " +
        "niet, koos ergens anders, of het was een dubbele/foutieve registratie).",
      waarden: [
        "Gekocht",
        "Blijft rijden",
        "Geen reactie klant",
        "Dubbel",
        "Toekomstige lead",
        "Intern",
        "Auto al verkocht",
        "Andere dealer",
        "Vreemd merk",
        "Inruilprijs te laag",
        "Ander eigen merk (VAG)",
        "Andere dealer zelfde merk ivm sturing",
        "Proefrit afgebeld",
        "Nieuw lease contract gesloten (VAG)",
        "Afwijzing financiering",
        "Andere dealer zelfde merk ivm inruilprijs",
        "EXPIRED",
        "Nieuw lease contract gesloten (VREEMD)",
      ],
      leegBetekent: "nog open, of afsluitreden niet geregistreerd",
    },
    {
      naam: "klantsoort",
      type: "text",
      betekenis: "Of de lead een zakelijke of particuliere klant betreft.",
      waarden: ["Zakelijk", "Particulier"],
      leegBetekent: "niet geregistreerd — komt vaker voor dan gevuld, dus reken hier niet blind mee als representatieve verdeling",
    },
    {
      naam: "aangelegd",
      type: "timestamp",
      betekenis: "Moment waarop de lead is aangelegd. Gebruik deze kolom voor alle vragen over 'wanneer'.",
    },
    {
      naam: "campagne",
      type: "text",
      betekenis:
        "Naam van de campagne waaraan deze lead is toegeschreven, exact zoals de " +
        "campagnenaam op de Campagnes-tab. Circa 40% van de leads heeft geen campagne " +
        "(organisch/niet-toegeschreven verkeer).",
      leegBetekent: "niet aan een campagne toegeschreven (organisch)",
    },
    {
      naam: "lead_type",
      type: "text",
      betekenis: "Type contactverzoek.",
      waarden: ["Overig", "Offerte", "Proefrit", "Private Lease", "Contact", "Inruilvoorstel"],
    },
    {
      naam: "order_geworden",
      type: "boolean",
      betekenis: "Of deze lead is omgezet in een order.",
    },
  ],

  regels: [
    "Een 'open' lead is een lead zonder sluitreden (sluitreden is null). Een lead is pas " +
      "definitief verloren of gewonnen zodra sluitreden gevuld is.",
    "'Gekocht' als sluitreden en order_geworden = true zijn twee verschillende signalen " +
      "uit twee verschillende systemen en hoeven niet 1-op-1 gelijk te lopen. Vraagt " +
      "iemand naar conversie/omzetting naar order, gebruik dan order_geworden.",
    "Er bestaat geen koppeling tussen v_leads en v_orders op regelniveau (geen gedeeld " +
      "ID) — zie de valkuil hieronder.",
    "Campagnecijfers (budget, uitgaven, doelen) staan niet in deze tabel. Vraagt iemand " +
      "daarnaar in combinatie met leads, zeg dan dat dat (nog) niet gekoppeld beschikbaar is.",
  ],

  synoniemen: {
    lead: "elke rij in deze tabel",
    interesse: "elke rij in deze tabel",
    bron: "kanaal of kanaalgroep, afhankelijk van hoe specifiek de vraag is",
    "omgezet naar order": "order_geworden = true",
    "verloren lead": "sluitreden is not null and sluitreden <> 'Gekocht'",
  },

  valkuilen: [
    "v_orders (het andere tabblad) heeft geen lead-ID of ander gedeeld veld met v_leads " +
      "— join ze niet op merk/model/datum, dat levert willekeurige matches op. Beide " +
      "views zijn losse extracten; beantwoord vragen die een echte koppeling nodig " +
      "hebben met 'dat kan ik niet betrouwbaar koppelen' in plaats van te gokken.",
    "'Dubbel' als sluitreden betekent dat de lead zelf als duplicaat is aangemerkt — " +
      "tel die niet dubbel mee bij het optellen van unieke klantinteresses als de vraag " +
      "daarom vraagt, maar laat hem wel gewoon meetellen bij 'hoeveel leads kwamen er binnen'.",
      "kanaal, merk en klantsoort zijn bij een deel van de leads niet ingevuld (leeg). " +
      "Groepeer je erop, dan verschijnt er een lege/'onbekend'-groep — benoem die expliciet " +
      "in plaats van hem stilzwijgend weg te filteren.",
  ],

  voorbeelden: [
    {
      vraag: "Hoeveel leads kwamen er in augustus 2026 binnen, per kanaalgroep?",
      sql:
        "select kanaalgroep, count(*) as aantal_leads\n" +
        "from v_leads\n" +
        "where aangelegd >= date '2026-08-01'\n" +
        "  and aangelegd <  date '2026-09-01'\n" +
        "group by kanaalgroep\n" +
        "order by aantal_leads desc",
      toelichting:
        "kanaalgroep kan leeg zijn (niet geregistreerd) — die groep verschijnt gewoon " +
        "mee als lege waarde, dat is geen fout.",
    },
    {
      vraag: "Welk deel van de leads wordt uiteindelijk een order?",
      sql:
        "select\n" +
        "  count(*) filter (where order_geworden) as orders,\n" +
        "  count(*) as totaal_leads,\n" +
        "  round(100.0 * count(*) filter (where order_geworden) / count(*), 1) as conversie_pct\n" +
        "from v_leads",
      toelichting:
        "Gebruik order_geworden, niet sluitreden = 'Gekocht' — dat is een ander veld " +
        "met een andere bron (zie de bedrijfsregels).",
    },
    {
      vraag: "Wat zijn de meest voorkomende redenen dat een lead niet tot een order leidt?",
      sql:
        "select sluitreden, count(*) as aantal\n" +
        "from v_leads\n" +
        "where sluitreden is not null\n" +
        "  and sluitreden <> 'Gekocht'\n" +
        "group by sluitreden\n" +
        "order by aantal desc\n" +
        "limit 10",
    },
  ],
};
