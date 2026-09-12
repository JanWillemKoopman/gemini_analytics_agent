# Kanalen (Windsor.ai) — haalbaarheidsonderzoek

Dit document is de inventarisatie die vooraf gaat aan het bouwen van het tabblad
**Kanalen** in het campagnedashboard: wat er met de Windsor.ai-koppeling mogelijk is,
waar de valkuilen zitten, en welke keuzes eerst gemaakt moeten worden. Er is nog geen
regel code voor geschreven — dat is bewust, zie "Wat ik van je nodig heb" onderaan.

---

## 0. Status van dit onderzoek — lees dit eerst

**Ik heb de API niet live kunnen bevragen.** Het uitgaand netwerkbeleid van deze
werkomgeving blokkeert `connectors.windsor.ai` (de proxy antwoordt met 403 op de
CONNECT), en óók `windsor.ai` zelf, waar de velddocumentatie staat. Dat is een
organisatie-instelling van de omgeving, geen fout in de URL of de sleutel.

Wat dat betekent voor wat hieronder staat:

| Betrouwbaarheid | Wat |
| --- | --- |
| **Zeker** | De opbouw van de API (endpoints, parameters, responsvorm) — afgeleid uit Windsor's eigen open-source clients (`pywindsorai`, `windsoraiR`) en de dbt-packages. |
| **Zeker** | Welke connectoren in jullie account zitten en hoeveel accounts per connector — dat staat letterlijk in de `select_accounts` van jouw URL. |
| **Waarschijnlijk** | De veldnamen per connector. Ontleend aan Windsor's veldreferentiepagina's en changelogs, niet aan jullie account. Windsor toont per connector alleen de velden die het platform teruggeeft, dus de definitieve lijst kan afwijken. |
| **Onbekend** | Datahistorie (vanaf wanneer heeft Windsor jullie data?), volume (aantal rijen), of alle 26 accounts daadwerkelijk data leveren, en of de aangekondigde Meta-deprecaties jullie velden raken. |

Alles wat als "te verifiëren" is gemarkeerd, is met één API-aanroep te bevestigen zodra
de host opengezet is of zodra jij de uitvoer een keer aanlevert. Concrete commando's
staan in §9.

---

## 1. Wat er aan de Windsor-kant staat

Jouw `select_accounts` bevat **26 accounts over 6 connectoren**. De prefix vóór de
dubbele underscore is de connectornaam; die bepaalt welke velden beschikbaar zijn.

| Connector | Aantal | Wat het is | Voor welk tabblad |
| --- | --- | --- | --- |
| `facebook` | 6 | **Meta Ads** — betaalde advertenties op Facebook én Instagram (Instagram-ads lopen via deze connector, niet via `instagram`). Campagne-, adset-, advertentie- en creative-niveau. | Advertenties |
| `linkedin` | 5 | **LinkedIn Ads** — betaalde campagnes. | Advertenties |
| `google_ads` | 1 | **Google Ads** (account 210-769-6929). Geen social; zie de kanttekening in §7. | Advertenties |
| `facebook_organic` | 6 | **Facebook Page Insights** — organische pagina- en postprestaties. | Organisch + Account |
| `instagram` | 4 | **Instagram Insights** — organische posts/reels + accountcijfers (de ID's beginnen met `17841`, dat zijn IG-business-accounts). | Organisch + Account |
| `linkedin_organic` | 4 | **LinkedIn Pages** — organische posts, paginabezoek, volgers en demografie. | Organisch + Account |

Drie observaties die er meteen toe doen:

1. **De aantallen lopen niet gelijk** (6 Meta-adaccounts, 6 FB-pagina's, 4 IG-accounts,
   5 LinkedIn-adaccounts, 4 LinkedIn-pagina's). Er is dus geen 1-op-1 relatie tussen
   "merk/vestiging" en "account". Wie bij welk merk of label hoort, staat *niet* in de
   data — Windsor geeft alleen de platformnaam terug (`account_name`). Dat is een
   koppeltabel die wij zelf moeten aanleggen, en het is de eerste voorwaarde voor
   bruikbare filters.
2. **Er ontbreken kanalen** die je bij "social" zou verwachten: geen TikTok, YouTube,
   Pinterest, X, Snapchat, geen Google Business Profile. Als die wel gevoerd worden,
   moeten ze eerst in Windsor gekoppeld worden — de dashboardkant is daar verder
   ongevoelig voor.
3. **Instagram-ads zitten in `facebook`, niet in `instagram`.** Een veelgemaakte fout is
   die twee optellen; dan tel je betaald bereik bij organisch bereik op.

---

## 2. Hoe de API werkt

**Endpoint.** `https://connectors.windsor.ai/{connector}` — met `{connector}` = `all`,
`facebook`, `linkedin`, `google_ads`, `facebook_organic`, `instagram`,
`linkedin_organic`.

**Parameters.**

| Parameter | Betekenis |
| --- | --- |
| `api_key` | Authenticatie, als querystring. |
| `fields` | Kommagescheiden lijst van de kolommen die je terug wilt. Bepaalt óók de granulariteit: vraag je `ad_id` mee, dan krijg je rijen per advertentie; laat je hem weg, dan aggregeert Windsor. |
| `date_preset` | `last_7d`, `last_14d`, `last_28d`, `last_30d`, `last_90d` e.d. |
| `date_from` / `date_to` | `YYYY-MM-DD`. Alternatief voor `date_preset`; dit is wat we nodig hebben voor een historische backfill. |
| `select_accounts` | De accountselectie zoals in jouw URL (`connector__accountid`). |
| `_renderer` | `json` (standaard) of `csv`. |

**Respons.** JSON van de vorm `{"data": [ {...}, {...} ]}` — één plat record per rij,
sleutels zijn de gevraagde veldnamen.

**Rate limits.** Windsor hanteert een globale rate limit en antwoordt met HTTP 429 plus
quota-headers bij overschrijding. Exacte limieten staan niet in de publieke docs; dit is
een reden om níet per paginabezoek te bevragen (zie §5).

**De `/all`-endpoint is niet wat je wilt.** `all` is de "blended data"-connector: hij
bevraagt alle bronnen tegelijk en zet er een `source`-kolom bij. Dat werkt alleen goed
voor de handvol velden die álle connectoren delen (`date`, `source`, `campaign`,
`spend`, `clicks`, `impressions`). Windsor's eigen documentatie stelt het scherp: van de
~34.700 velden hoort vrijwel elk veld bij één enkele bron. In jouw voorbeeld-URL staan
`post_id` en `followers_count` naast `spend` en `campaign` — die komen dus per definitie
nooit op dezelfde rij terug; je krijgt een tabel met veel lege cellen. **Advies: per
connector een eigen aanroep** met precies de velden die die connector kent.

---

## 3. Tabblad 1 — Advertenties (betaald)

Bronnen: `facebook`, `linkedin`, `google_ads`.

**Dimensies** (waarop gefilterd en uitgesplitst kan worden):
`date`, `datasource`/`source`, `account_id`, `account_name`, `campaign` + `campaign_id`,
`adset_name` + `adset_id` (Meta) / `campaign_group` (LinkedIn) / `ad_group` (Google),
`ad_name` + `ad_id`, `creative_id`, `objective`, `publisher_platform` (Facebook /
Instagram / Audience Network) en `platform_position`, `adset_daily_budget`,
`adset_bid_strategy`, `adset_start_time` / `adset_end_time`. Meta levert daarnaast een
`thumbnail_url` en (sinds een recente update) een deelbare advertentie-previewlink —
waardevol, want dan zie je in de tabel wáár je naar kijkt.

**Metrics:** `spend`, `impressions`, `reach`, `frequency`, `clicks`, `ctr`, `cpc`, `cpm`,
videoweergaven, engagement, en conversies (Meta o.a. `actions_omni_purchase` en
`actions_offsite_conversion_fb_pixel_purchase`; LinkedIn en Google hebben hun eigen
conversievelden).

**Wat hiermee kan:** spend/bereik/klikken/CTR/CPC/CPM per dag-week-maand-kwartaal, per
platform, per account, per campagne, tot op advertentieniveau — inclusief de
"welke advertentie presteert onder verwachting"-tabel die je wil.

**Valkuilen:**

- **Conversies zijn niet vergelijkbaar tussen platformen.** Meta, LinkedIn en Google
  tellen elk in hun eigen attributievenster, en Meta heeft in 2025 de toewijzing in de
  tijd gewijzigd. Eén kolom "conversies" die over drie platformen optelt, is misleidend.
- **Cijfers van gisteren veranderen nog.** Attributievensters vullen dagen na dato aan.
  Een sync moet daarom niet alleen nieuwe dagen ophalen maar een voortschrijdend venster
  (bv. 30 dagen) opnieuw ophalen en overschrijven.
- **Valuta.** LinkedIn rapporteert kosten in lokale valuta én accountvaluta. Vastleggen
  welke je gebruikt, anders tel je euro's bij dollars op.
- **Google Ads hoort hier eigenlijk niet.** Zie §7.

---

## 4. Tabblad 2 — Organisch (onbetaalde posts)

Bronnen: `facebook_organic`, `instagram`, `linkedin_organic`.

**Wat er beschikbaar is (indicatief, te verifiëren):**

- **Instagram** (~124 velden): `media_id`, `media_type`, `media_url`, `caption`,
  permalink, `media_impressions`, `media_reach`, `media_like_count`,
  `media_comments_count`, saves, shares, `media_engagement`, kijktijd en
  reel-specifieke metrics.
- **Facebook Page Insights** (~318 velden): post-ID, bericht, posttype, impressies,
  bereik, reacties, comments, shares, kliks.
- **LinkedIn Pages** (~160 velden): post-impressies, unieke impressies, kliks, CTR,
  reacties, comments, shares, engagement rate, organisch vs viraal bereik.

**Twee valkuilen die het ontwerp van dit tabblad bepalen:**

1. **Postdata is géén tijdreeks.** De cijfers van een post zijn "lifetime tot nu" en
   blijven groeien zolang de post bereik krijgt. Een grafiek "bereik per dag" op
   postdata betekent dus in de praktijk *"posts die op die dag gepubliceerd zijn, met
   hun resultaat tot nu toe"* — en dat cijfer verandert morgen weer, ook voor gisteren.
   Dat is verdedigbaar, maar het moet expliciet in de UI staan, anders vergelijkt
   iemand een post van gisteren met een post van drie maanden geleden en trekt de
   verkeerde conclusie. Mijn voorstel: de tijdas op dit tabblad is de **publicatiedatum**,
   en de tabel krijgt een kolom "leeftijd" plus een optie "alleen posts ouder dan 7
   dagen" zodat je rijpe posts met rijpe posts vergelijkt.
2. **Meta heeft op 15 juni 2026 organische pagina-metrics afgeschaft.** Dat is drie
   maanden geleden. Een aantal klassieke Facebook Page Insights-velden (met name rondom
   bereik) geeft sindsdien niets meer terug; Meta introduceert een nieuwe "Page Viewer"-
   metric als vervanger. **Welke velden dit voor jullie raakt, is het eerste dat we
   moeten meten** — het bepaalt of een Facebook-organisch tabblad überhaupt nog
   vergelijkbaar is met Instagram en LinkedIn.

---

## 5. Tabblad 3 — Account (kanaalontwikkeling)

Bronnen: `facebook_organic` (page fans/follows), `instagram` (`followers_count`,
`follows_count`, `media_count`), `linkedin_organic` (volgeraantal, volgersgroei, en
uitsplitsing naar functie, senioriteit, branche, bedrijfsgrootte, land — organisch en
betaald gescheiden).

**De belangrijkste bevinding van dit hele onderzoek staat hier:** volgersaantallen zijn
bij vrijwel alle platformen een **momentopname**, geen historie. Instagram's API geeft
maar een beperkt venster terug, en wat Windsor bewaart hangt af van wanneer de connector
is aangezet. Je kunt volgersgroei over 2024 dus mogelijk niet meer ophalen — die
historie bestaat simpelweg niet meer als niemand hem heeft weggeschreven.

**Gevolg voor de planning:** de dagelijkse snapshot van volgersaantallen is het enige
onderdeel waar uitstel onherstelbaar verlies oplevert. Mijn advies is om die sync als
eerste te bouwen en te laten draaien — ook als het tabblad zelf pas over een maand af
is. Elke dag wachten is een dag historie die je nooit meer krijgt.

---

## 6. Voorgestelde architectuur

Het dashboard heeft hier al een beproefd patroon voor: **sheets → Postgres via een
nachtelijke cron** (`app/api/sync/route.ts`, `lib/sync/bronnen.ts`,
`supabase/migrations/0001_dataloket.sql`). Windsor past daar naadloos in en dat is
verreweg het verstandigste model. Niet live per paginabezoek bevragen, om drie redenen:

1. De API-sleutel mag nooit in de browserbundel belanden.
2. Windsor's rate limit is gedeeld; een druk dashboard zou hem opeten.
3. Filteren, vergelijken met een vorige periode en joinen met jullie eigen
   campagnegegevens kan alleen fatsoenlijk in SQL.

**Voorstel voor de tabellen** (schema `dataloket`, nieuwe migratie `0014_kanalen.sql`):

| Tabel | Granulariteit | Bron |
| --- | --- | --- |
| `kanaal_accounts` | één regel per Windsor-account | handmatig/beheer-UI: windsor-id → merk, label, vestiging, type (betaald/organisch), platform |
| `kanaal_ads_dag` | datum × account × campagne × adset × advertentie | `facebook`, `linkedin`, `google_ads` |
| `kanaal_posts` | post × meetmoment | `facebook_organic`, `instagram`, `linkedin_organic` |
| `kanaal_account_dag` | datum × account | volgers, bereik, paginaweergaven |

- Voortschrijdend venster van 30 dagen opnieuw ophalen en upserten (attributie vult na);
  eenmalig een backfill met `date_from` zo ver terug als Windsor data heeft.
- Hergebruik `dataloket.sync_runs` en `sync_afwijkingen`, zodat "data bijgewerkt om" en
  de afwijkingenlijst meteen werken zoals bij de bestaande bronnen.
- `v_`-views + een bestand in `lib/dictionary/tabellen/` erbij: dan kan de **chatbot er
  meteen vragen over beantwoorden** en kan het team grafieken naar het prikbord pinnen.
  Dat is bijna gratis meegenomen en het is precies waar dat systeem voor gebouwd is.
- Sleutel en accountselectie in `WINDSOR_API_KEY` / `WINDSOR_ACCOUNTS` (env), nooit in
  code of in de client.

---

## 7. Kritiek op het plan — en hoe het beter kan

Het plan is goed en de driedeling klopt. Wat ik zou aanscherpen:

**1. "Campagnemanager" bestaat niet in Windsor.** Geen enkel platform levert een
eigenaar of beheerder mee. Dat filter kan alleen bestaan als wij de koppeling zelf
vastleggen. Twee opties: afleiden uit een naamconventie in de campagnenaam (broos), of
een koppeltabel die je beheert in de UI — en dat laatste past bij wat er al staat
(`Campagnebeheer`). Advies: koppeltabel op account + campagne, met een vangnet
"niet toegewezen" dat zichtbaar blijft in plaats van stil weg te vallen.

**2. Kies niet volledig vrij welke metrics in de grafiek mogen.** Een vrije metric-
picker levert onherroepelijk een grafiek op met `spend` en `followers` op dezelfde as.
Beter: maximaal twee metrics tegelijk, tweede as expliciet, plus een handvol
voorgedefinieerde combinaties per vraag ("kost per resultaat", "bereik vs engagement",
"volgersgroei vs postfrequentie"). Dat is sneller in gebruik én minder fout.

**3. Voeg een uitsplits-dimensie toe naast de metric-keuze.** Met 26 accounts over 4
platformen is "welke metric" maar de helft van de vraag; "waarnaar uitgesplitst"
(platform / account / merk / campagne / posttype) is de andere helft. Eén lijn per
platform zegt meer dan één lijn totaal.

**4. Elke periode heeft een vergelijking nodig.** Marketeers sturen op verschil, niet op
niveau. Standaard "vorige periode" met "vorig jaar" als alternatief, en het verschil in
de tabel naast de waarde — het dashboard doet dit al zo bij de campagnedoelen
(`MetricCell`), dus het patroon staat er.

**5. Zet de filterstand in de URL.** Een sticky filterbalk is precies goed; maak hem
bovendien deelbaar, zodat "kijk even naar dit" een link is in plaats van een instructie.
De bestaande `lib/campagneFilterContext.tsx` is het sjabloon, met de filterstand erbij
in de querystring.

**6. Vergelijkbaarheid tussen platformen is de grootste inhoudelijke valkuil.**
Facebook-"bereik", LinkedIn-"impressies" en Instagram-"views" zijn drie verschillende
dingen. Nooit stilzwijgend optellen. Wel: een expliciete canonieke metriek-laag waarin
per platform staat welk veld eronder valt, en de bestaande "Zo lees je dit"-knop met
precies die uitleg erin.

**7. Eén begrip "campagne", twee betekenissen.** Het huidige tabblad Campagnes komt uit
de sheet en gaat over leads en orders; Kanalen gaat over platformcampagnes. Dat zijn
verschillende objecten met soms dezelfde naam. Benoem dat in de UI, anders ontstaan er
twee waarheden.

**8. En daar zit meteen de grootste kans.** Zodra spend uit Windsor naast leads en
orders uit de sheet ligt, kun je kosten per lead en kosten per order per campagne laten
zien — het cijfer waar dit hele dashboard eigenlijk om draait, en dat nu in geen van
beide bronnen los te zien is. Dat vraagt wel een koppeling tussen de platformcampagnenaam
en de campagnenaam in de sheet. Ik zou dat niet in fase 1 proberen, maar wél de
koppeltabel nu al zo ontwerpen dat het later kan.

**9. Beveiliging: de API-sleutel in je bericht is nu gecompromitteerd.** Hij stond in
platte tekst in de opdracht. Roteer hem in Windsor voordat we hem ergens vastleggen, en
zet de nieuwe alleen in de omgevingsvariabelen van Vercel.

**10. Alleen desktop, dat blijft zo.** Conform `CLAUDE.md`: geen responsive varianten,
brede tabellen met sticky eerste kolom.

---

## 8. Voorgestelde fasering

| Fase | Wat | Waarom in deze volgorde |
| --- | --- | --- |
| **0** | Verificatie: één aanroep per connector, veldenlijst en datahistorie vastleggen. | Alles hieronder hangt af van wat er echt terugkomt. |
| **1** | Sync + tabellen + de dagelijkse **volgerssnapshot**. Nog geen UI. | Historie die je nu niet wegschrijft, is straks weg. |
| **2** | Tabblad **Advertenties**: filterbalk, grafiek met dag/week/maand/kwartaal, campagne- en advertentietabel. | Grootste bedrag, duidelijkste data, meeste stuurmogelijkheid. |
| **3** | Tabblad **Organisch**, met de rijpheidsoplossing uit §4. | Vraagt de meeste ontwerpkeuzes; profiteert van de filterbalk uit fase 2. |
| **4** | Tabblad **Account**, inclusief LinkedIn-demografie. | Heeft dan al historie opgebouwd sinds fase 1. |
| **5** | Koppeling platformcampagne ↔ campagne uit de sheet → kosten per lead/order. | De echte prijs, maar alleen zinvol als 2–4 staan. |

---

## 9. Wat ik van je nodig heb

**Om verder te kunnen (één van beide):**

- **Optie A** — `connectors.windsor.ai` (en liefst `windsor.ai`) toevoegen aan het
  netwerkbeleid van deze omgeving. Dan inventariseer ik de velden zelf.
- **Optie B** — jij draait de onderstaande commando's lokaal en levert de uitvoer aan.
  Zes kleine bestanden zijn genoeg. Vervang `$KEY` door de (nieuwe, geroteerde) sleutel.

```bash
# Per connector: welke velden komen er echt terug, en vanaf wanneer is er data?
for c in facebook linkedin google_ads facebook_organic instagram linkedin_organic; do
  curl -s "https://connectors.windsor.ai/$c?api_key=$KEY&date_preset=last_30d&fields=date,account_name,campaign,spend,impressions,clicks" \
    -o "windsor_$c.json"
done

# En één brede test per organische connector, om de postvelden te zien:
curl -s "https://connectors.windsor.ai/instagram?api_key=$KEY&date_preset=last_30d&fields=date,account_name,followers_count,media_id,media_type,caption,media_reach,media_like_count" -o windsor_instagram_posts.json
```

**Beslissingen die ik niet voor je kan nemen:**

1. **Hoort Google Ads in dit dashboard?** Het is de enige niet-sociale bron in je
   selectie. Meenemen maakt het "kanalendashboard" i.p.v. "socialdashboard" — prima,
   maar dan moeten de labels dat zeggen.
2. **Welk account hoort bij welk merk/vestiging?** Zonder die lijst is er geen zinnig
   merkfilter. Een simpele tabel (windsor-id → merk, label) is genoeg.
3. **Wie zijn de campagnemanagers en waar leg je die koppeling vast?** Zie §7.1.
4. **Welke conversie telt?** Meta lead ads, websiteconversies via de pixel, of jullie
   eigen leads uit de sheet? Dit bepaalt of tabblad 1 op kosten of op rendement stuurt.
5. **Zijn er kanalen die nog niet in Windsor gekoppeld zijn** (TikTok, YouTube,
   Pinterest)? Die kun je nu koppelen en dan bouwen we er meteen op.

---

## Bronnen

- Windsor.ai API-documentatie: <https://windsor.ai/api-documentation/>
- Veldreferenties: <https://windsor.ai/data-field/facebook/>,
  <https://windsor.ai/data-field/facebook_organic/>,
  <https://windsor.ai/data-field/instagram/>,
  <https://windsor.ai/data-field/linkedin/>,
  <https://windsor.ai/data-field/linkedin_organic/>,
  <https://windsor.ai/data-field/all/>
- Meta-deprecatie organische pagina-metrics (15 juni 2026):
  <https://windsor.ai/documentation/guide-for-deprecating-metrics-for-facebook-organic-connector-june-15-2026/>
- Meta attributie-/bereikwijzigingen:
  <https://windsor.ai/documentation/facebook-ads-meta-api-updates-june-10-2025/>
- Open-source clients waaruit de API-opbouw is afgeleid:
  <https://github.com/windsor-ai/pywindsorai>, <https://github.com/windsor-ai/windsoraiR>,
  <https://github.com/windsor-ai/dbt_facebook_ads>
