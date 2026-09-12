# Windsor.ai — inventarisatie voor het tabblad "Kanalen"

Dit document is het resultaat van een technisch onderzoek naar de Windsor.ai-connectie
(september 2026). Het beschrijft wat er feitelijk in de API zit, waar de harde grenzen
liggen, en wat dat betekent voor het ontwerp van de drie tabbladen (Advertenties,
Organisch, Account) onder het nieuwe sidebar-kopje **Kanalen**.

Alles onder "Wat er in zit" en "Harde beperkingen" is **gemeten** tegen de live API, niet
uit documentatie overgenomen. Alles onder "Advies" is interpretatie.

---

## 1. Hoe de API werkt

Twee endpoints, allebei met de API-sleutel in de query string:

| Endpoint | Gebruik |
| --- | --- |
| `GET connectors.windsor.ai/all?fields=…&select_accounts=…` | Alle connectoren tegelijk. Accounts met prefix: `facebook__69324444`. |
| `GET connectors.windsor.ai/<connector>?fields=…&select_accounts=…` | Eén connector. Accounts **zonder** prefix: `69324444`. |
| `GET connectors.windsor.ai/all/fields?api_key=…` | De volledige veldcatalogus (4.393 velden), inclusief per veld in welke connectoren het bestaat. |

Periode: `date_preset=last_7d` of `date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`.
Output: JSON (`{"data":[…]}`) of CSV via `&_renderer=csv`.

Gemeten gedrag dat het ontwerp raakt:

- **`/all` is alles-of-niets.** Eén connector die een fout geeft (bv. een datum buiten
  Meta's 37-maandsvenster) laat de héle request falen met HTTP 400. Per connector
  ophalen is daarom robuuster.
- **De connectorkeuze volgt de velden.** Vraag je `spend` en `impressions` op via `/all`,
  dan krijg je alleen rijen van de connectoren die die velden kennen — de organische
  connectoren blijven dan stil. Elke connector heeft z'n eigen veldnamen.
- **Windsor cachet.** Dezelfde request tweemaal: 9,6 s → 0,8 s.
- **Niet alle velden mogen samen.** Voorbeeld van een geweigerde combinatie:
  `publisher_platform` + `platform_position` samen met `quality_ranking`
  ("Breakdown fields … are incompatible with 'omni' and 'ranking' fields").

### Gemeten responstijden (koude call)

| Query | Tijd |
| --- | --- |
| Google Ads, advertentieniveau, 6 weken (13.242 rijen) | 7 s |
| LinkedIn Ads, creative-niveau, 6 weken | 7 s |
| Meta Ads, per platform + plaatsing, 11 dagen (2.334 rijen) | 13 s |
| Facebook-pagina's, dagelijks, 6 maanden (1.170 rijen) | 15 s |
| Meta Ads, advertentieniveau, 6 weken (3.660 rijen) | 45 s |
| Instagram, per post, 3 maanden (193 posts) | 61 s |
| LinkedIn organic, per post / per account, 3 maanden | 68 – 81 s |
| Facebook organic, per post, 3 maanden (219 posts) | **131 s** |

**Conclusie: live bevragen vanuit de browser kan niet.** Een dashboard dat 131 seconden
op Facebook staat te wachten is geen dashboard. Dit moet via een nachtelijke sync naar
Postgres — precies het patroon dat er al ligt (`app/api/sync/route.ts` + Vercel Cron).

---

## 2. Wat er in het account zit

Zes connectoren, 26 accounts, 4.393 unieke velden.

| Connector | Wat het is | Accounts | Velden |
| --- | --- | ---: | ---: |
| `facebook` | **Meta Ads** — betaald op Facebook *én* Instagram *én* Threads | 6 | 913 |
| `google_ads` | Google Ads (Search, Pmax, Demand Gen, Display) | 1 | 2.791 |
| `linkedin` | LinkedIn Ads | 5 | 233 |
| `facebook_organic` | Facebook-pagina's: posts + paginacijfers | 6 | 323 |
| `instagram` | Instagram Insights (organisch) | 4 | 124 |
| `linkedin_organic` | LinkedIn-bedrijfspagina's: posts + paginacijfers | 4 | 190 |

### De accounts, met hun huidige volgeraantal

**Facebook-pagina's** — Van den Udenhout 13.138 · Porsche Centrum Brabant 20.481 ·
Porsche Centrum Maastricht 5.846 · Audi Sport Eindhoven 3.547 · Instra 708 · VELOO 181

**Instagram** — porschebrabant 32.976 · porschecentrummaastricht 22.057 ·
udenhoutgroep 3.618 · veloonl 208

**LinkedIn-pagina's** — Porsche Centrum Brabant 10.510 · Van den Udenhout Groep 6.141 ·
Porsche Centrum Maastricht 1.359 · VELOO 184

**Meta Ads-accounts** — Van den Udenhout · Porsche Groep Zuid · Porsche centrum
Maastricht · Bentley Maastricht · Veloo

**Google Ads** — Udenhout (één account, 38 campagnes actief)

**LinkedIn Ads** — 5 accounts geconfigureerd; in de afgelopen week had alleen
"PGZ Moved by Mobility" data, in augustus ook "Van den Udenhout Groep".

> **Gaten in de dekking.** De accountlijsten lopen niet gelijk. Bentley Maastricht heeft
> wel een Meta Ads-account maar geen Facebook-pagina en geen Instagram in de feed. Audi
> Sport Eindhoven en Instra hebben een Facebook-pagina maar geen Instagram. Er zit geen
> TikTok en geen YouTube in. Dat is geen fout van de koppeling — die accounts zijn simpelweg
> niet toegevoegd in Windsor. Het is wel iets om te besluiten vóór we bouwen, want een
> dashboard dat "alle kanalen" belooft en Bentley's Instagram mist, verliest vertrouwen.

---

## 3. Wat er per tabblad mogelijk is

### 3.1 Advertenties (betaald)

Volledige hiërarchie beschikbaar: **account → campagne → adset/ad group → advertentie**,
per dag.

*Dimensies (Meta):* `campaign`, `campaign_id`, `campaign_objective`,
`campaign_effective_status`, `adset_name`, `ad_id`, `ad_name`, `effective_status`,
`publisher_platform` (facebook/instagram/threads), `platform_position` (feed, reels,
stories, search, instream_video …), `age`, `gender`, `impression_device`, `country`,
`call_to_action_type`, `buying_type`, `quality_ranking`, `engagement_rate_ranking`,
`conversion_rate_ranking`.

*Creatives:* `thumbnail_url`, `image_url`, `carousel_card_media_urls`,
`ad_preview_shareable_link` (werkende preview-link), `body`, `title`,
`website_destination_url`. **Je kunt de advertentie dus letterlijk laten zien in de
tabel** — dat is voor marketeers vaak waardevoller dan de naam.

*Metrics:* `spend`, `impressions`, `reach`, `frequency`, `clicks`, `ctr`, `cpc`, `cpm`,
`actions_link_click`, `actions_lead`, `actions_post_engagement`, `actions_video_view`,
`actions_landing_page_view`, plus het volledige video-kijkverloop per seconde
(`video_play_curve_actions_s0…s14`).

*Maatwerkconversies — dit is het goud.* Meta levert jullie eigen conversie-acties als
kant-en-klare velden: `actions_proefrit_aanvraag`, `actions_offerte_aanvraag`,
`actions_inruilvoorstel`, `actions_werkplaatsplanner`, `actions_verhuurmodule`,
`actions_sollicitatie`, `actions_solliciteren_met_cv`, `actions_snel_solliciteren`,
`actions_meeloopdagen_aangemeld`, `actions_fijner_rijden_pas_aangevraagd`,
`actions_live_chat`, `actions_contact_to_lead_for_udenhout_nl`, `actions_pce_klik_op_whatsapp`,
`actions_pce_klik_telefoonnummer`, `actions_pce_klik_routebeschrijving` en meer.
Google Ads doet hetzelfde met de GA4-conversies:
`all_conversions_ga4_…_generate_lead_offerte`, `…_generate_lead_inruilen`,
`…_generate_lead_financiering`, `…_bedanktpagina_werkplaatsplanner`, enzovoort.

Dat betekent: **kosten per proefrit, per offerteaanvraag of per sollicitatie, per
campagne, per advertentie** — niet alleen een generieke "conversie".

*LinkedIn Ads:* `campaign_group_name` → `campaign` → `creative_id`, met `spend`,
`impressions`, `clicks`, `ctr`, `cpc`, `total_engagements`, `oneclickleads`,
`externalwebsiteconversions`, `video_views`, videokwartielen, en de volledige
targeting-specificatie. Ook "viral" varianten van alles (organisch bereik dat uit een
gesponsorde post voortkomt).

*Google Ads:* `campaign_type` (SEARCH/PMAX/DEMAND_GEN/DISPLAY), `ad_group_name`,
`ad_id`, `ad_type`, `ad_group_ad_ad_strength`, `device`, `ad_network_type`, plus de
zoektermen- en keyword-velden.

### 3.2 Organisch (onbetaalde posts)

Eén rij per post, gedateerd op publicatiedatum, met de *lifetime* cijfers van die post.

| | Facebook | Instagram | LinkedIn |
| --- | --- | --- | --- |
| ID | `post_id` | `media_id` | `post_id` (URN) |
| Tekst | `post_message_oneline` | `media_caption` | `share_text` |
| Type | `type`, `reels_post_type` | `media_product_type` (FEED/REELS/STORY) | `share_post_type` (image/video/document/article/poll/text) |
| Beeld | `full_picture`, `post_picture` | `media_url`, `media_thumbnail_url` | `share_thumbnail_id` |
| Link | `permalink_url` | `media_permalink` | `share_url` |
| Bereik | `post_impressions_unique` | `media_reach` | `share_unique_impressions_count` |
| Vertoningen | `post_impressions_organic` / `_paid` | `media_views` | `share_impression_count` |
| Interactie | `post_engagements` | `media_engagement`, `media_like_count`, `media_comments_count`, `media_saved`, `media_shares` | `share_total_engagements`, `share_engagement_rate` |
| Volgers uit post | `post_video_followers` (reels) | `media_follows` | — |

Instagram heeft daarnaast volledige **Stories**-cijfers (`story_reach`, `story_replies`,
`story_exits`, `story_taps_forward`, `story_taps_back`, `story_swipe_forward`) en
**Reels**-cijfers (`media_reel_total_watch_time`, `media_reel_avg_watch_time`,
`media_reel_skip_rate`).

Facebook levert ook de **reacties per post** (`comment_text`, `comment_timestamp`,
`comment_like_count`) — bruikbaar, maar het is persoonsgegeven van derden; niet zonder
reden opslaan.

Volume in de praktijk: ±220 Facebook-posts, ±195 Instagram-posts en ±195 LinkedIn-posts
per kwartaal over alle accounts samen.

### 3.3 Account (accountontwikkeling)

| Platform | Volgers over tijd | Dagelijkse groei | Overig per dag |
| --- | --- | --- | --- |
| **Facebook** | ✅ `page_fans`, `page_follows` — echte dagelijkse historie | ✅ `page_daily_follows`, `page_daily_unfollows` | `page_impressions`, `page_impressions_organic`, `page_impressions_paid`, `page_post_engagements`, `page_views_total` |
| **LinkedIn** | ✅ `organization_follower_count` per dag | ✅ `followers_gain_organic`, `followers_gain_paid` | `all_page_views`, `account_analytics_impression_count`, `account_analytics_total_engagements`, en paginaweergaven per subpagina (jobs, careers, about, people, products) |
| **Instagram** | ❌ **alleen vandaag** | ⚠️ alleen laatste 30 dagen | `reach`, `accounts_engaged`, `total_interactions`, `profile_links_taps`, `media_count` |

Facebook geeft bovendien de volgersopbouw naar stad, land, leeftijd en geslacht;
LinkedIn naar land, regio, functie, senioriteit, bedrijfsgrootte en branche — inclusief
de splitsing organisch/betaald.

---

## 4. De zeven harde beperkingen die het ontwerp bepalen

**1. Instagram heeft geen volgershistorie.** Gemeten: `followers_count` geeft precies
één rij per account, met de datum van vandaag, ongeacht welke periode je opvraagt.
`follower_count_1d` (nieuwe volgers per dag) werkt alleen over de laatste 30 dagen en
geeft dan `followers_count = null`. Een grafiek "Instagram-volgers over het afgelopen
jaar" is dus **niet te maken uit de API** — die historie bestaat nergens.
*Gevolg:* we moeten zelf elke nacht de stand wegschrijven. Hoe eerder we daarmee
beginnen, hoe eerder die grafiek iets laat zien. Dit is het enige onderdeel van dit
project dat écht tijdkritisch is.

**2. Meta gaat 37 maanden terug, en geen dag verder.** Gemeten foutmelding: de vroegst
beschikbare startdatum voor het oudste advertentieaccount is 2023-08-12. Ook dit pleit
voor opslaan: wat we nu binnenhalen, houden we.

**3. "Instagram-advertenties" zitten níet in de Instagram-connector.** De `instagram`-
connector is puur organisch. Betaald verkeer op Instagram zit in de `facebook`-connector,
herkenbaar aan `publisher_platform = instagram`. Gemeten verdeling over 11 dagen:
facebook/feed 312 rijen, instagram/feed 300, instagram/reels 278, facebook/reels 277,
instagram/stories 272, facebook/stories 261, threads/feed 62. Een tabbladindeling die
naïef op `datasource` splitst, zet Instagram-advertenties dus onder "Facebook".
*Gevolg:* het platformfilter moet op `publisher_platform` draaien, niet op de connector.

**4. "Organisch bereik" is niet hetzelfde als "bereik van een organische post".**
`post_impressions` telt betaalde distributie mee. Een post die is opgehoogd, ziet er in
die kolom uit als een organisch succes. Alleen `post_impressions_organic` is echt
organisch. Bij LinkedIn is er hetzelfde onderscheid via de `viral_*`-velden.
*Gevolg:* het tabblad Organisch moet standaard op de organische variant staan, met de
betaalde kolom ernaast als context — niet andersom.

**5. Betaald en organisch zijn aan elkaar te koppelen — dat is een kans.** Gemeten: bij
alle 837 advertentierijen in de steekproef was `effective_object_story_id` gevuld
(formaat `paginaID_postID`, precies het formaat van `post_id` in `facebook_organic`), en
`instagram_permalink_url` matcht `media_permalink` uit de Instagram-connector. We kunnen
dus per post laten zien: *dit is organisch gepresteerd, dit kwam uit de €X die we erop
hebben gezet.* Dat is precies de vraag die een marketeer bij het opjagen van een post
stelt, en geen enkel platform beantwoordt hem in één scherm.

**6. "Campagnemanager" bestaat niet in de data.** Ik heb alle 4.393 velden doorzocht: er
is geen eigenaar- of beheerdersveld. Het dichtste in de buurt komt Meta's
wijzigingslogboek (`activity_actor_name` — wie heeft wat aangepast), en dat is iets
anders dan "van wie is deze campagne".
*Twee opties:* (a) een koppeltabel in Supabase (campagnenaam → collega), te beheren in
het dashboard zelf — past bij hoe Kennis en acties nu al werkt; of (b) de
campagnenaamconventie uitbreiden met initialen. Optie (a) heeft mijn voorkeur: naamconventies
worden altijd een keer vergeten, en een koppeltabel is achteraf te corrigeren.

**7. De campagnenamen bevatten al bruikbare dimensies.** Meta hanteert
`<nr>. <Categorie> - <Onderwerp> - <jaar>` (1. Acties, 2. Marketing, 3. Acties Porsche,
4. Vacatures), Google hanteert `<Type> | <Categorie> - <Onderwerp>` (T = Search,
Demand Gen, Pmax, GD = Display). Daaruit zijn **categorie** (Acties / After Sales /
Sales / Vacatures / Verhuur / Branding), **merk** (Audi, Škoda, VW, SEAT, Porsche) en
**jaar** af te leiden zonder extra invoer. Merk sluit meteen aan op de bestaande
`brandLogos.tsx`.

Kleinere aandachtspunten: kwartaal bestaat alleen als veld in Google Ads (zelf afleiden
uit de datum dus — geen probleem als we dagdata opslaan); LinkedIn organic levert
paginaweergaven en volgercijfers in *aparte rijen* voor dezelfde dag, met `null` in de
andere kolommen (de sync moet die samenvoegen); en Meta/Google herzien conversiecijfers
nog dagen na dato, dus de sync moet een voortschrijdend venster (±30 dagen) opnieuw
ophalen in plaats van alleen gisteren.

---

## 5. Kritiek op het plan, en wat ik anders zou doen

Het plan is in de kern goed: de driedeling advertenties / organisch / account is precies
hoe marketeers hun werk indelen, en filters + grafiek + tabellen is de juiste volgorde.
Zes dingen zou ik veranderen of toevoegen.

**a. Begin vandaag met opslaan, bouw daarna pas de UI.** Instagram-volgershistorie
ontstaat pas vanaf het moment dat we hem wegschrijven. Elke week wachten is een week
grafiek die we nooit meer terugkrijgen. De sync is een klein, op zichzelf staand stuk
werk dat losstaat van alle ontwerpkeuzes hieronder.

**b. "Metrics vrij kiezen" wordt een doolhof.** Er zijn 4.393 velden; ook na opschonen
houden we er per tabblad tientallen over. Een lege dropdown met honderd opties is geen
vrijheid maar huiswerk. Beter: **per tabblad een vaste, doordachte set van tien à
veertien metrics** met Nederlandse namen en een "zo lees je dit"-zin — precies zoals de
campagnetabel dat nu al doet. Wie meer wil, heeft de chatbot.

**c. Voeg een vergelijking met de vorige periode toe.** Een grafiek zonder referentie
laat zien *wat* er gebeurde, niet *of dat goed is*. Zonder "vorige periode" of "vorig
jaar" blijft elke vraag in het weekoverleg hangen bij "is dit veel?". Dit is de
goedkoopste toevoeging met de grootste opbrengst.

**d. Splits "Advertenties" niet per platform maar toon platform als dimensie.** Eén
tabel over Meta, Google en LinkedIn heen, met `publisher_platform` als filter én als
kleur in de grafiek. Marketeers willen budget kunnen vergelijken tussen kanalen; drie
losse platformtabellen maken dat juist onmogelijk.

**e. Overweeg een vierde blok: organisch versus betaald op dezelfde post.** Zie punt 5
hierboven. Dit hoeft geen apart tabblad te zijn — een kolom "waarvan betaald" in de
organische tabel en een "was ook organisch"-markering in de advertentietabel volstaat.
Het is weinig werk en het beantwoordt een vraag die nu nergens te beantwoorden is.

**f. Google Ads past niet in het woord "Kanalen" zoals jij het bedoelt — maar laat hem
er wel in.** Google is verreweg de grootste post in de data (13.242 advertentierijen in
zes weken tegen 3.660 van Meta) en hoort thuis in elke budgetvergelijking. Het gevolg is
alleen dat de tabbladen Organisch en Account leeg zijn voor Google. Dat is prima, zolang
het dashboard dat eerlijk toont ("Google Ads heeft geen organische posts") in plaats van
een lege tabel.

**g. Losstaand, maar belangrijk: de kolom "Uitgaven" in de campagnesheet kan hiermee
vanzelf gevuld worden.** De campagnetabel houdt nu handmatig bij wat er is uitgegeven.
Windsor weet dat per dag per campagne. Bij een naamkoppeling tussen sheetcampagne en
advertentiecampagne vervalt dat handwerk. Dat is een apart besluit — ik noem het hier
omdat het onderzoek het opleverde, niet om het scope in te trekken.

**h. Rouleer de API-sleutel.** De sleutel uit je bericht staat nu in een chatlog en geeft
toegang tot alle advertentie- en accountdata van de hele groep. Maak in Windsor een nieuwe
aan, zet die als `WINDSOR_API_KEY` in de omgeving, en laat hem nooit in clientcode of in
een URL in de browser terechtkomen. Alle calls lopen dan via de server, net als de
Claude-sleutel nu.

---

## 6. Voorgestelde architectuur

Eén op één het patroon dat er al ligt, dus geen nieuw gereedschap:

```
Vercel Cron (nachtelijk)
      ↓
/api/windsor-sync          ← per connector ophalen, voortschrijdend venster van 30 dagen
      ↓
Supabase / Postgres        ← 4 ruwe tabellen + v_-views (schema dataloket)
      ↓
/api/kanalen/*             ← server-side aggregatie per dag/week/maand/kwartaal
      ↓
Kanalen → Advertenties | Organisch | Account
```

Vier tabellen, elk met hun eigen korrel:

| Tabel | Korrel | Groei per jaar (geschat uit de meting) |
| --- | --- | --- |
| `windsor_advertenties` | dag × advertentie | ±150.000 rijen |
| `windsor_posts` | post (lifetime cijfers, bijgewerkt zolang de post jong is) | ±2.500 rijen |
| `windsor_account_dag` | dag × account | ±10.000 rijen |
| `windsor_campagne_eigenaar` | campagne → collega (handmatig, punt 6) | tientallen |

Dat is klein genoeg om alles in Postgres te aggregeren, en groot genoeg om het niet in de
browser te willen doen. De dagkorrel maakt dag/week/maand/kwartaal een kwestie van
`date_trunc`, en de opslag lost meteen de Instagram- en 37-maandsbeperking op.

De drie tabbladen delen één filtercontext (net als `CampagneFilterProvider` nu doet voor
Campagnes en Tijdlijn), met een plakkende filterbalk bovenaan: **periode, platform,
account, en per tabblad een specifiek filter** (advertenties: campagne, doelstelling,
status, plaatsing, campagnemanager · organisch: posttype · account: niets extra's).

---

## 7. Wat ik van jou nodig heb voor we bouwen

1. **Scope van de accounts.** Bentley, Audi Sport Eindhoven, Instra en TikTok/YouTube
   hebben nu geen volledige dekking. Eerst in Windsor aanvullen, of bouwen met wat er is?
2. **Google Ads mee of niet** in het tabblad Advertenties (mijn advies: wel).
3. **Campagnemanager:** koppeltabel in het dashboard (mijn advies) of naamconventie?
4. **Welke conversies tellen als "resultaat"?** Er zijn er tientallen. Welke vijf à zes
   wil je als standaardkolom zien — proefrit, offerte, inruilvoorstel, werkplaatsplanner,
   sollicitatie?
5. **Mag de sync nu al aan**, vooruitlopend op de UI? (Mijn advies: ja, vanwege de
   Instagram-historie.)
