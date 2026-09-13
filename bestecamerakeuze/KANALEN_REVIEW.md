# Kanalen — review van interface, bruikbaarheid en datakwaliteit

Datum: 13 september 2026 · Scope: de vijf tabbladen onder **Kanalen** (Social ads,
Google Ads, Organisch, Account, Koppeltabel).

Deze review is gedaan als gebruiker: de pagina's zijn lokaal gedraaid met representatieve
demodata (Meta/Google/LinkedIn-campagnes, posts en accountreeksen in exact het formaat dat
`lib/kanalen/bron.ts` uit Postgres levert), er zijn screenshots gemaakt van elke pagina en
van de belangrijkste interacties, en daarna is de code doorgelopen op de plekken waar het
beeld vragen opriep. De demo-aansluiting is na afloop weer verwijderd; er staat geen
tijdelijke code in de repo.

De hoofdvraag: **kun je met deze pagina's je advertenties, je organische posts en je
accounts monitoren en zó analyseren dat je je strategie bijstuurt — zonder omslachtig
klikken?**

Kort antwoord: de fundering is sterk. De kubus-aanpak (één ophaalactie, daarna filteren in
het geheugen) maakt filteren echt instant, de scheiding tussen optelbare en afgeleide
statistieken is netjes gedaan, en de leeswijzers zijn beter dan bij de meeste betaalde
tools. Maar het is nu vooral een **kijkdashboard**, nog geen **stuurdashboard**: er is
nergens een vergelijking met een vorige periode, geen vrije periode, geen doel of budget,
en geen enkel signaal dat zegt "hier moet je naar kijken". Daarnaast staan er een paar
kolommen in beeld die met de huidige sync per definitie leeg blijven.

---

## 1. Per pagina, als gebruiker

### Social ads

Het beste uitgewerkte tabblad. Zes filters, grafiek met korrel- en uitsplitskeuze, drie
tabellen (campagnes, advertenties met creative, "plaatsing"). Wat opvalt bij gebruik:

- Bij het openen op "30 dagen" staat de grafiek op **week** — vijf staven voor een maand.
  Het dagverloop, dat je juist wilt zien, moet je zelf aanzetten.
- Het campagnefilter is een lijst zonder zoekveld met namen die na ±28 tekens worden
  afgekapt ("Audi Q4 e-tron — Voorj…"). Met de naamgeving die advertentieplatforms in de
  praktijk hebben zijn campagnes zo niet uit elkaar te houden.
- De derde tabel heet **Plaatsing** maar toont Facebook/Instagram/LinkedIn — precies
  hetzelfde als het platformfilter erboven. De échte plaatsing (feed, stories, reels)
  wordt wél gesynct en staat in de view, maar wordt niet opgehaald.
- Geen totaalrij onder de tabel, geen vergelijking met vorige periode, geen budget of doel.

### Google Ads

Zelfde opbouw, en dat is de kracht ervan. Maar: **Leads** en **Kosten per lead** staan als
standaardkolom in beeld terwijl de sync voor Google hard een `0` wegschrijft — Google levert
leads via de conversie-acties. In productie is dat dus een kolom met louter nullen en een
CPL-kolom met louter streepjes, op de pagina waar leads het belangrijkste getal zijn. De
leeswijzer legt uit waaróm, maar de kolom staat er nog steeds.

### Organisch

De pagina waar de meeste kleine dingen wringen:

- De tabel belooft "nieuwste bovenaan te sorteren", maar er is **geen datumkolom** en je
  kunt niet op datum sorteren. Bij een post weet je dus niet wanneer hij live ging.
- Posts worden samengevoegd op hun **tekst**. Twee posts met dezelfde caption (een
  terugkerende actie, een reel en een feedpost met dezelfde tekst) worden één regel, en de
  telling "8 regels" klopt dan niet.
- De korrelkeuze (dag/week/maand/kwartaal) hangt af van op hoeveel dagen je gepost hebt in
  plaats van van de gekozen periode. Gemeten: bij "30 dagen" waren week, maand én kwartaal
  uitgeschakeld; bij "12 maanden" was kwartaal uitgeschakeld.

### Account

Hier staat het duidelijkste beeldprobleem: **volgers wordt als staafdiagram vanaf nul
getekend.** Vijf staven van ±47.000 naast elkaar — de groei, het enige wat je op deze
pagina wilt zien, is onzichtbaar. Een stand hoort een lijn te zijn met een as die niet op
nul begint. De tabellen eronder (Groei, Nieuwe volgers) redden de pagina, maar de grafiek
doet niets.

### Koppeltabel

Slim bedacht: begint bij de duurste campagne zonder eigenaar, slaat per veld op. Twee
dingen die het in de praktijk laten afglijden:

- Campagnemanager en merk zijn **vrije tekstvelden**. Elke typefout ("Sanne de wit") wordt
  een eigen filterwaarde op de advertentiepagina's.
- De uitleg belooft dat wat je invult "daarna als filter werkt op de pagina's Social ads en
  Google Ads". Dat geldt alleen voor campagnemanager: **merk en categorie zijn nergens
  filter**, terwijl ze wel in de view staan. Voor een dealergroep is merk juist hét filter.

---

## 2. Aanbevelingen

Effort: **S** = onder een halve dag · **M** = één à drie dagen · **L** = een week of meer.
Impact is gewogen op "helpt dit iemand een besluit te nemen in het weekoverleg".

### A. Bugs en datafouten (eerst dit — het raakt vertrouwen in de cijfers)

| # | Wat | Waar | Effort | Impact |
|---|-----|------|--------|--------|
| A1 | Google Ads toont Leads en Kosten per lead terwijl de sync daar `0` wegschrijft. Kolommen verbergen voor Google, of (beter, zie B) de conversie-acties ontsluiten. | `lib/windsor/sync.ts` (Google-mapping), `GoogleAdsPaneel.tsx` | S | Hoog |
| A2 | Volgers als staaf vanaf nul; groei onzichtbaar. Standkolommen als lijn tekenen met een as op `['auto','auto']`. | `TijdGrafiek.tsx` (`alsLijn`, `YAxis`) | S | Hoog |
| A3 | De ververs-knop kan in productie uit de browsercache komen (`max-age=300, stale-while-revalidate=3600` + `fetch()` zonder cache-optie). Vooral vervelend direct na "Data ophalen": je ziet dan de cijfers van vóór de sync. Handmatig herladen met `cache: "no-store"`. *(Niet in dev te reproduceren — Next stript de header daar; dit volgt uit de code.)* | `app/api/kanalen/route.ts`, `lib/kanalen/gebruik.ts` | S | Hoog |
| A4 | Eerste en laatste periode in de grafiek zijn onvolledig zonder dat je het ziet; "vandaag" is altijd (bijna) leeg omdat de sync 's nachts draait. Periode t/m gisteren laten lopen en een randperiode visueel markeren. | `lib/kanalen/gebruik.ts` (`periodeGrenzen`), `TijdGrafiek.tsx` | S | Hoog |
| A5 | Merk en categorie uit de koppeltabel zijn geen filter, terwijl de UI dat wel belooft. Twee regels SQL erbij en twee filterdimensies. | `lib/kanalen/bron.ts`, `SocialAdsPaneel.tsx`, `GoogleAdsPaneel.tsx` | S | Hoog |
| A6 | Korrelkeuze hangt af van het aantal dagen mét data in plaats van de lengte van de periode. Rekenen op de periodegrenzen. | `lib/kanalen/kubus.ts` (`bruikbareKorrels`) | S | Middel |
| A7 | Standaardkorrel is de gróófste beschikbare; bij "30 dagen" open je op weken. Kies dag t/m ±31 dagen, week t/m ±120, daarboven maand. | `TijdGrafiek.tsx` | S | Middel |
| A8 | Posts groeperen op tekst en advertenties op naam: duplicaten vallen samen en de creative van de eerste wint. Groeperen op `post_id` / `advertentie_id`, naam als label. | `lib/kanalen/bron.ts`, `StatistiekTabel.tsx` | M | Middel |
| A9 | Koppeltabel zet `gekoppeld: true` bij élke bewaaractie, ook bij het leegmaken van de naam of het invullen van alleen het merk. Teller en rood bolletje kloppen daarna niet. | `Koppeltabel.tsx`, `bron.ts` (`haalKoppelingen`) | S | Middel |
| A10 | Tabel "Plaatsing" groepeert op platform en dupliceert daarmee het platformfilter; het echte veld `plaatsing` wordt wel gesynct maar niet opgehaald. | `lib/kanalen/bron.ts`, `SocialAdsPaneel.tsx` | S–M | Middel |
| A11 | Detailtabellen zijn afgekapt op 2.000 regels zonder waarschuwing, terwijl het KPI-getal erboven uit de volledige reeks komt. Bij veel advertenties tellen tabel en KPI dan niet meer op. | `lib/kanalen/bron.ts`, `StatistiekTabel.tsx` | S | Middel |
| A12 | Conversiewaarde en ROAS zijn voor Meta altijd leeg (de sync schrijft er `0`), maar zijn wel aan te zetten zonder uitleg. | `sync.ts`, `velden.ts` | S | Middel |
| A13 | De nachtelijke sync ververst alleen de laatste 30 dagen; alles daarvoor is bevroren, inclusief conversies die later in het attributievenster nog binnenkomen. Eén keer per week een ruimer venster laten meelopen. | `lib/windsor/sync.ts` (`VENSTER_DAGEN`), `vercel.json` | M | Middel |
| A14 | Bereik wordt ook over platforms en plaatsingen opgeteld, niet alleen over dagen; frequentie is daardoor structureel te laag. Minimaal in de leeswijzer zetten. | `SocialAdsPaneel.tsx` (leeswijzer) | S | Laag–Middel |
| A15 | De eenheid "seconden" bestaat in `Statistiek` maar wordt nergens gerenderd — gemiddelde kijktijd is een kaal getal. | `StatistiekTabel.tsx`, `TijdGrafiek.tsx` (`eenheidVan`) | S | Laag |
| A16 | Euro's krijgen onder €10 twee decimalen en daarboven nul, dus "€ 9,80" naast "€ 10" in dezelfde CPL-kolom. Percentages idem ("3%" naast "2,8%"). | `components/chat/chartTheme.ts` | S | Laag |
| A17 | `/api/kanalen` staat niet in de middleware-matcher; bij een verlopen sessie krijg je een 401 terwijl de pagina ingelogd oogt. | `middleware.ts` | S | Laag–Middel |

### B. Wat er ontbreekt om echt te kunnen sturen

| # | Wat | Effort | Impact |
|---|-----|--------|--------|
| B1 | **Vergelijking met de vorige periode.** Bij elk KPI-getal en elke tabelcel een Δ en %-verschil t.o.v. de vorige even lange periode, en optioneel een tweede, lichtere lijn in de grafiek. Dit is de grootste ontbrekende functie: "€ 61.538 uitgaven" zegt zonder "+12% t.o.v. vorige 30 dagen" niets. | M | Zeer hoog |
| B2 | **Vrije periodekiezer** naast de vier knoppen: "vorige maand", "deze maand tot nu", "sinds startdatum campagne", of twee datums. De code noemt dit zelf al als de plek waar dat hoort. | M | Hoog |
| B3 | **Laatste sync in beeld.** `laatsteSync` wordt al opgehaald maar alleen in de lege staat getoond. Zet hem in de filterbalk ("bijgewerkt vannacht 03:12, t/m 12 sep"). Zonder dat weet je niet of je naar cijfers van vannacht of van vorige week kijkt. | S | Hoog |
| B4 | **Iets kunnen vastleggen op de plek waar je het ziet.** Het hele dashboard draait om beeld → besluit → terugblik, maar de "+"-knop staat alleen op de campagne- en teamtabbladen. Juist op de kanaalpagina's, waar je de afwijking ontdekt, kun je niets noteren. Dezelfde zijbalk hier beschikbaar maken, met de campagne al ingevuld. | S | Hoog |
| B5 | **Datumkolom en sorteren op datum bij posts**, plus per post het account en type in de regel. Nu kun je niet zien wanneer een post live ging. | S | Hoog |
| B6 | **KPI-strip met sparklines** boven de grafiek: uitgaven, klikken, CTR, CPC, leads, CPL naast elkaar met hun verloop en hun verschil t.o.v. vorige periode. Nu moet je per metric de dropdown omzetten — dat is precies de omslachtigheid waar je naar vroeg. | M | Hoog |
| B7 | **Totaalrij (en gewogen gemiddelde) onder elke tabel.** Je ziet acht campagnes, maar niet wat de selectie samen doet. | S | Middel |
| B8 | **Kanalen naast elkaar.** Social en Google staan bewust apart, maar er is nergens een beeld van het totale advertentiebudget over kanalen — terwijl ze in dezelfde tabel zitten en de code die vergelijking expliciet als doel noemt. Eén extra weergave ("Alle betaalde kanalen") of een uitsplitsing op bron. | M | Hoog |
| B9 | **Budget en doel op de kanaalpagina's.** De sheet heeft budget en doelen per campagne, de koppeltabel legt de link. Daarmee kan er pacing bij ("67% van het budget op dag 20 van 30") in plaats van alleen een absoluut bedrag. | L | Hoog |
| B10 | **Signalering.** Een klein blok bovenaan: campagnes waarvan CPL deze week meer dan x% afwijkt van de vier weken ervoor, advertenties die stilgevallen zijn, accounts die volgers verliezen. Dit is wat "monitoren" van "kijken" onderscheidt. | L | Hoog |
| B11 | **Advertentiestatus tonen** in de advertentietabel (staat al in de meta, wordt niet gebruikt), zodat je ziet of iets nog loopt. | S | Middel |
| B12 | **Exporteren en vastpinnen.** CSV-download per tabel, en dezelfde "pin op prikbord" die de chat al heeft. | S / M | Middel |
| B13 | **Conversie-acties ontsluiten.** De sync haalt de maatwerkconversies al op in `conversie_acties` (jsonb) maar de UI doet er niets mee. Een keuzelijst "welke conversie telt als lead" per account lost A1 op én maakt Google Ads pas echt bruikbaar. | L | Hoog |
| B14 | **Benchmark bij organisch**: interactieratio t.o.v. het gemiddelde van dat account in dezelfde periode, zodat "4,1%" iets betekent. | M | Middel |

### C. Interface en bedieningsgemak

| # | Wat | Effort | Impact |
|---|-----|--------|--------|
| C1 | **Zoekveld in de filterdropdowns**, breder paneel en een `title` op afgekapte namen. Met tientallen gelijkende campagnenamen is de lijst nu onwerkbaar. | S | Hoog |
| C2 | **Actieve filters als chips** in de filterbalk, elk los weg te klikken, in plaats van alleen "1 geselecteerd" per dropdown. | S | Middel |
| C3 | **Periode en filters in de URL**, zodat een selectie een refresh overleeft en te delen is met een collega. | M | Middel |
| C4 | **Kolomkeuze onthouden** (localStorage of profiel). Nu begin je elke sessie opnieuw, per tabel. | S | Middel |
| C5 | **Campagnemanager als keuzelijst** van collega's uit `profielen` (met de mogelijkheid iets nieuws te typen) in plaats van vrij tekstveld; merk idem uit een vaste merkenlijst. Voorkomt dat typefouten filterwaarden worden. | S | Middel–Hoog |
| C6 | **Zoekveld en sorteren in de koppeltabel** (nu alleen "Alle / Nog niet gekoppeld / Al gekoppeld"). | S | Middel |
| C7 | **Geneste scrollbalken opheffen**: drie tabellen met elk een eigen `max-h-[32rem]` binnen een pagina die zelf ook scrollt. Laat de tabellen volledig uitklappen of geef ze "toon meer". | S | Laag–Middel |
| C8 | **Sorteren op een verborgen kolom** kan nu: zet je de sorteerkolom uit via Kolommen, dan blijft de tabel erop gesorteerd zonder dat je het ziet. Terugvallen op de eerste zichtbare kolom. | S | Laag |
| C9 | **Laadskelet** in plaats van een lege pagina met "Laden…" in de balk; bij 12 maanden is de payload ±425 KB en dat is merkbaar. | S | Laag |
| C10 | **De twee ververs-acties** (het pijltje en "Data ophalen") staan naast elkaar en lijken hetzelfde; alleen de eerste heeft een tooltip. Zet ze uit elkaar of geef het pijltje ook een woord. | S | Laag |
| C11 | **"Data ophalen" is een gedeelde actie** die minuten duurt: laat zien wanneer hij voor het laatst draaide en of iemand anders hem nu al gestart heeft. | M | Middel |
| C12 | **Reeksen aan/uit in de legenda** bij een uitsplitsing. | S | Laag |

---

## 3. Voorgestelde volgorde

**Ronde 1 — vertrouwen en het laaghangende fruit (samen ongeveer een dag, allemaal S)**
A1, A2, A3, A4, A5, A6, A7, A9 · B3, B4, B5, B7 · C1, C2, C8.

Dit haalt de kolommen weg die per definitie leeg zijn, laat de volgersgroei eindelijk zien,
zorgt dat de ververs-knop doet wat hij belooft, zet merk en categorie als filter aan, en
maakt de filters bruikbaar met veel campagnes. Grootste winst per uur werk.

**Ronde 2 — van kijken naar sturen (M-werk, ongeveer een week)**
B1 (vergelijking met vorige periode), B2 (vrije periode), B6 (KPI-strip met sparklines),
B8 (kanalen naast elkaar) · A8, A10, A13 · C3, C4, C5.

**Ronde 3 — de grote stappen (L)**
B13 (conversie-acties, lost Google Ads structureel op), B9 (budget en pacing uit de sheet),
B10 (signalering). Deze drie maken van Kanalen een dashboard dat uit zichzelf vertelt waar
je moet kijken.

---

## 4. Wat goed is en zo moet blijven

Voor de volledigheid, want dit hoort niet in een lijst met verbeteringen te verdwijnen:

- **Filteren zonder netwerkverkeer.** De kubus met labelindexen is een goede keuze en werkt
  merkbaar: 6.867 regels over twaalf maanden filteren zonder enige vertraging.
- **Afgeleiden ná het optellen berekenen.** CTR, CPC en CPL worden nergens gemiddeld. Dat
  is precies de fout die de meeste dashboards wél maken.
- **Volgers als stand en niet als som.** De `standKolommen`-constructie is de juiste
  oplossing voor een echt lastig probleem, inclusief de val naar de laatst bekende meting.
- **De keuzelijsten tonen alleen waarden die nog voorkomen** in de huidige selectie — geen
  doodlopende filters.
- **De leeswijzers.** "Zo lees je dit" en de zin per pagina over hoe je de cijfers moet
  lezen (Instagram-historie uit eigen meting, lifetime-cijfers op de publicatiedatum,
  bereik per dag uniek) zijn eerlijker dan wat de platforms zelf tonen.
