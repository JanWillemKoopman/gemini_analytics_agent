# Social media — Facebook via Windsor.ai

Het tabblad **Social media → Facebook** toont wat de advertenties en de Facebook-pagina's
opleverden. De data komt niet uit de Google Sheet en niet uit Supabase, maar live uit de
datafeed van [Windsor.ai](https://windsor.ai): daar zijn de Meta-accounts eenmalig
gekoppeld, en Windsor levert de cijfers terug als JSON per connector.

## Aansluiten

Eén omgevingsvariabele, server-only:

```
WINDSOR_API_KEY=…
```

De sleutel staat in Windsor.ai onder **Destinations → Python/R Code**, in de URL achter
`api_key=`. Dezelfde sleutel geldt voor alle connectors.

**Nooit als `NEXT_PUBLIC_`-variabele.** Windsor zet de sleutel in de query-string van elke
aanroep; met een `NEXT_PUBLIC_`-prefix zou hij in de browserbundel staan en kan iedereen
alle gekoppelde accounts uitlezen. Daarom haalt uitsluitend de server-route
`app/api/social/facebook/route.ts` de data op, achter de inlog, en krijgt de browser
alleen het opgetelde resultaat.

Zonder de variabele blijft de rest van het dashboard normaal werken; het tabblad Facebook
vertelt dan wat er ontbreekt (`components/NietGeconfigureerd.tsx`).

## Twee connectors, bewust apart

| Connector | Wat het is | Rijen |
|---|---|---|
| `facebook` | **betaald** — de advertentieaccounts (Meta Ads) | één per dag per campagne |
| `facebook_organic` | **onbetaald** — de Facebook-pagina's zelf | per dag per pagina én per bericht |

Die twee staan in de UI in aparte blokken en worden **nooit bij elkaar opgeteld**: een
betaalde weergave uit een advertentie en een organische weergave van een bericht zijn niet
dezelfde gebeurtenis, en de organische feed rapporteert de paginacijfers toch al inclusief
het betaalde deel.

Gekoppeld zijn nu vijf advertentieaccounts (Van den Udenhout, Porsche Groep Zuid, Porsche
Centrum Maastricht, Bentley Maastricht, Veloo) en zes pagina's (dezelfde, plus Porsche
Centrum Brabant, Audi Sport Eindhoven en Instra). Windsor heeft ook `instagram`,
`linkedin`, `linkedin_organic` en `google_ads` klaarstaan — zie "Een kanaal toevoegen".

## Wat er in de datalaag gebeurt (`lib/windsor.ts`)

Vier dingen die zonder uitleg als een bug zouden lezen:

1. **Verhoudingsgetallen worden niet opgevraagd.** `ctr`, `cpc`, `cpm` en `frequency`
   bestaan in Windsor, maar dat zijn cijfers *per rij*; optellen of gemiddelden geeft een
   verkeerd periodecijfer (een dag met € 2 uitgaven zou even zwaar wegen als een dag met
   € 800). De pagina rekent ze opnieuw uit de opgetelde grondgetallen met `deel()`.
2. **Bereik is een dagsom, geen uniek periodebereik.** Meta rapporteert bereik per dag als
   "unieke personen"; wie op meer dagen bereikt is, telt in de som meer dan één keer. Een
   uniek bereik over een hele periode is niet uit dagcijfers te herleiden en geeft Meta ook
   niet mee. De kolom heet daarom **Dagbereik** en de leeswijzer boven de grafiek zegt het
   er ook bij — verzwijgen of als uniek presenteren is de enige echt foute optie.
3. **Volgers zijn een voorraad, geen dagsom.** `page_fans` is de totale stand op die dag;
   optellen geeft honderdduizenden. De tabel toont de laatst bekende stand in de periode,
   en apart wat er in de periode bijkwam (`page_daily_follows`, dát is wel een dagsom).
4. **Pagina's en berichten zitten in één feed.** Een rij met een `post_id` is een bericht
   (met levenslange cijfers, op de dag van plaatsing); een rij zonder `post_id` is de
   dagstand van de pagina. Op berichtrijen staan de paginavelden op 0 — zonder die
   splitsing valt elk paginacijfer op een dag met berichten te laag uit.

Daarnaast: **accountnamen worden genormaliseerd.** Meta kent dezelfde vestiging onder twee
schrijfwijzen ("Veloo" in het advertentieaccount, "VELOO" op de pagina; "Porsche centrum
Maastricht" tegenover "Porsche Centrum Maastricht"). Zonder normalisatie staan die als twee
losse regels in het accountfilter en zie je bij de een alleen de advertenties en bij de
ander alleen de pagina. `canoniekeAccountnamen()` groepeert op de naam zonder hoofdletters
en kiest de nettere schrijfwijze; de keuze hangt niet af van de rijvolgorde die Windsor
teruggeeft.

**Niet opgevraagd: `post_video_views`.** Meta vult dat veld voor inline video en reels niet
meer — een bericht met 34.000 weergaven meldt er 52. Een cijfer dat de kolom ernaast
tegenspreekt kost meer vertrouwen dan het oplevert. Wie videoprestaties wil meten heeft de
reels-velden nodig (`post_video_view_time`, `blue_reels_play_count`) en moet éérst nagaan
of die voor deze pagina's wél gevuld zijn.

De aggregatie staat volledig in pure functies met tests (`lib/windsor.test.ts`,
`npm test`) — geen netwerk nodig om te controleren dat de optelling klopt.

## Hoe de pagina is opgebouwd

- `app/api/social/facebook/route.ts` — checkt de inlog, begrenst de periode (max 180 dagen;
  langer wordt de Windsor-aanroep traag en de grafiek onleesbaar) en haalt beide connectors
  parallel op. Valt er één weg, dan blijft de andere helft staan met een waarschuwing
  erboven; alleen als beide wegvallen komt er een fout.
- `components/social/Facebook.tsx` — de pagina. Haalt één keer per periode op en filtert
  daarna in de browser op account, zodat het accountfilter meteen reageert. De totalen
  worden met dezelfde `telMetingen()` uitgerekend als de server gebruikt, dus filteren kan
  geen ander getal opleveren.
- `components/social/FacebookPaneel.tsx` — laadt de pagina pas bij gebruik (`dynamic`,
  `ssr: false`), zoals de chat en de kosten: Recharts hoort niet in de bundel van iemand die
  alleen de campagnetabel opent.
- `components/social/labels.ts` — Meta's veldwaarden in gewone taal (`OUTCOME_LEADS` →
  "Leads", `animated_image_video` → "Animatie"). Een onbekende waarde wordt leesbaar
  gemaakt in plaats van weggelaten, zodat opvalt dat er een vertaling bij moet.

**De grafiek heeft één y-as.** Uitgaven en clicks staan niet samen in één beeld met twee
assen: welke reeks dan "boven" ligt, hangt af van de schaalkeuze, en dat suggereert een
verband dat er niet hoeft te zijn. In plaats daarvan kiest de gebruiker de metriek met de
knoppenrij rechtsboven. Kleur hangt aan het account en niet aan de ranglijst, dus een
account wegfilteren verft de anderen niet om; accounts zonder advertentiedata (en een
eventueel zevende account als de kleurenreeks vol is) krijgen de neutrale contextkleur —
nooit een herhaalde tint.

## Een kanaal toevoegen

Instagram, LinkedIn of Google Ads erbij is hetzelfde patroon, niet een nieuw mechanisme:

1. Veldnamen opzoeken. Ze staan per connector in de Windsor-documentatie, of vraag ze op
   met de Windsor-MCP-tool `get_fields` (bijvoorbeeld `get_fields(connector: "instagram")`)
   — verzin ze niet, want een onbekende veldnaam levert stil een lege kolom op.
2. Een velden- en aggregatieblok in `lib/windsor.ts` erbij, met tests voor de optelling.
3. Een route onder `app/api/social/<kanaal>/route.ts`, in dezelfde vorm.
4. Een paneel in `components/social/`, een regel in het groepje "Social media" in
   `components/Sidebar.tsx` en een titel in `components/AppShell.tsx`.

## Bekende punten

- **Vandaag is nog onvolledig.** Windsor haalt de cijfers een paar keer per dag bij Meta
  op; de laatste dag in de periode loopt dus nog op. Dat staat ook onder de pagina.
- **Leads komen uit `actions_lead`**, het gegroepeerde totaal van Meta (instant forms,
  website-pixel en on-Facebook leads bij elkaar). Campagnes zonder leadformulier laten een
  streepje zien in plaats van een nul, zodat "niet van toepassing" en "nul leads" niet op
  elkaar lijken.
- **Kosten per lead op een verkoopcampagne** kan er vreemd hoog uitvallen (€ 500 bij één
  toevallige lead): het is uitgaven gedeeld door leads, en bij een campagne die niet op
  leads mikt zegt dat getal weinig. De kolom "Doel" staat er daarom naast.
- Er komt **geen eigen tabel in de database** voor deze cijfers: Windsor is de bron, net
  zoals de sheet de bron is voor de campagnetabel.
