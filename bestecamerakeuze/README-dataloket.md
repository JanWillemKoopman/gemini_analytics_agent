# Het dataloket — aansluiten

Het chattabblad ("Vraag het je data") is gebouwd maar staat uit tot de omgeving is
aangesloten. Zolang dat niet zo is, blijft het campagne-tabblad gewoon werken en toont
het chattabblad welke variabelen nog ontbreken.

Onderstaande stappen zijn eenmalig.

## 1. Migraties draaien

Voer in volgorde uit in de Supabase SQL-editor:
`supabase/migrations/0001_dataloket.sql`, dan `0002_gesprekken.sql`, dan
`0003_kennisbank.sql`, dan `0004_claude_kosten.sql`, dan `0005_campagne_notities.sql`,
dan `0006_profielen.sql`, dan `0007_google_ads.sql`.

De eerste zet de datalaag en de read-only rol neer, de tweede de gespreksgeschiedenis
(gesprekken, berichten, feedback — elk met rijbeveiliging zodat iedereen alleen zijn
eigen gesprekken ziet), de derde de kennisbank, de vierde de registratie van Claude
API-kosten (voedt het Kosten-tabblad; begint te vullen zodra de migratie draait, geen
historie van ervoor), de vijfde de aantekeningen/learnings per campagne (voedt de
aantekeningen-pop-up op het campagnedashboard — die knop verschijnt pas zodra Supabase
geconfigureerd is, ongeacht de andere twee dataloket-variabelen hieronder), de zesde de
naam + avatarfoto per collega (inclusief de `avatars`-bucket in Supabase Storage) — voedt
zowel Instellingen als de naam/foto bij elke aantekening, de zevende de vier
Google Ads-tabellen (campagnes, zoekwoorden, advertentiegroepen, conversies) — die
blijven leeg totdat `/api/sync-ads` voor het eerst draait (zie "Google Ads API
koppelen" hieronder).

Dat maakt het `dataloket`-schema aan met:

- `sync_runs` en `sync_afwijkingen` — wat is wanneer ingelezen, en welke rijen zijn afgekeurd
- `query_log` — elke vraag en elke uitgevoerde query, met RLS zodat iedereen alleen zijn eigen regels ziet
- `verkopen_raw` + `v_verkopen` — een **voorbeeldtabel** met zeven regels, zodat je de chat kunt uitproberen voordat de echte data er is
- de rol `dataloket_lezer` — de read-only rol waarop de chat draait

**Vervang `VERVANG_DIT_WACHTWOORD` in de migratie** voordat je hem draait.

## 2. De read-only verbinding pakken

Neem de connection string van Supabase (Project Settings → Database → Connection string →
**Transaction pooler**, poort 6543 — die is gemaakt voor serverless) en vervang gebruiker
en wachtwoord door `dataloket_lezer` en het wachtwoord uit stap 1.

Controleer dat de rol echt niet kan schrijven:

```sql
-- moet werken
select count(*) from v_verkopen;
-- moet falen met "permission denied"
delete from verkopen_raw;
```

Deze rol is de belangrijkste grens in het systeem. Gebruik hem nergens anders voor.

## 3. Omgevingsvariabelen zetten

In Vercel (of `.env.local` voor lokaal):

| Variabele | Waarvoor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | inloggen en het querylog |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | idem |
| `DATAQUERY_DATABASE_URL` | de read-only verbinding uit stap 2 |
| `ANTHROPIC_API_KEY` | de Claude API |
| `SYNC_DATABASE_URL` | schrijvende verbinding, alleen voor de sync-job |
| `CRON_SECRET` | beschermt `/api/sync` én `/api/sync-ads` tegen aanroepen van buiten |
| `SUPABASE_SERVICE_ROLE_KEY` | alleen voor `scripts/maak-gebruiker.ts`, nooit in de app zelf — zie hieronder |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | toegang tot de Google Ads API — zie "Google Ads API koppelen" |
| `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` | OAuth-client waarmee de refresh token is aangemaakt |
| `GOOGLE_ADS_REFRESH_TOKEN` | logt in namens de Google-gebruiker die toegang tot de Ads-accounts heeft, zonder wachtwoord opnieuw in te voeren |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | het manager-account (MCC) waaronder de klantaccounts hangen |
| `GOOGLE_ADS_CUSTOMER_IDS` | de klantaccounts die uitgelezen worden, kommagescheiden |

`DATAQUERY_DATABASE_URL` en `SYNC_DATABASE_URL` horen **verschillende** rollen te zijn.

## 4. Collega-accounts aanmaken

Inloggen gaat met e-mailadres + wachtwoord (geen magic link) — er is dus geen
zelfregistratie: iemand met toegang maakt het account aan en geeft de inloggegevens
direct door.

**Optie A — via Supabase:** Authentication → Users → Add user, vink "Auto Confirm User"
aan zodat er geen bevestigingsmail nodig is.

**Optie B — via het `gebruiker:maak`-script** (handig als je dit vanuit een
Claude Code-sessie wilt laten doen): zet `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
(Supabase → Project Settings → API → service_role secret — **nooit** in Vercel/de app
zelf, deze sleutel omzeilt alle rijbeveiliging) en draai:

```bash
npm run gebruiker:maak -- --email=collega@udenhout.nl --wachtwoord="EenSterkWachtwoord123" --naam="Voornaam Achternaam"
```

Bestaat het account al, dan wordt alleen het wachtwoord bijgewerkt — hetzelfde
commando werkt dus ook voor "wachtwoord vergeten". Zie `scripts/maak-gebruiker.ts`.

Elke collega kan daarna zelf bij **Instellingen** zijn naam en profielfoto instellen;
die worden onder andere getoond bij aantekeningen die diegene toevoegt aan een
campagne (zie `supabase/migrations/0006_profielen.sql`).

Standaard staat de inlog alleen vóór het chattabblad; het campagnedashboard blijft
publiek zoals het nu is. Wil je de héle app achter de inlog zetten, pas dan de `matcher`
in `middleware.ts` aan — dat staat als commentaar in het bestand.

## 5. De echte sheets koppelen

1. Zet per sheet een regel in `BRONNEN` in `lib/sync/bronnen.ts` (sheet-id, tabblad,
   doeltabel, sleutelkolom en de kolommapping).
2. Maak de bijbehorende tabel en `v_`-view aan in een nieuwe migratie.
3. Geef de view expliciet vrij: `grant select on dataloket.v_naam to dataloket_lezer;`
   Dat is bewust geen automatisme — een view die niemand heeft vrijgegeven, bestaat niet
   voor de chat.
4. Beschrijf de tabel in `lib/dictionary/tabellen/` en zet hem in de lijst in
   `lib/dictionary/index.ts`.

Stap 4 is het werk dat ertoe doet. Zie hieronder.

## Google Ads API koppelen

In tegenstelling tot de sheets loopt Google Ads niet via `lib/sync/bronnen.ts` maar via
een rechtstreekse, geauthenticeerde verbinding met de Google Ads API
(`lib/sync/googleAds.ts`, aangeroepen door `/api/sync-ads`). Dat vraagt vier dingen die
je eenmalig moet aanmaken:

1. **Developer token.** Log in op het [Google Ads API Center](https://ads.google.com/aw/apicenter)
   met het manager-account (MCC) en vraag een developer token aan. Nieuwe tokens
   krijgen automatisch **test access** (werkt alleen tegen test-accounts); voor de
   echte accounts moet je **basic access** aanvragen via hetzelfde scherm — dat is een
   handmatige beoordeling door Google en kan een paar dagen duren. Zonder goedkeuring
   krijg je een `DEVELOPER_TOKEN_NOT_APPROVED`-fout zodra de sync draait.
2. **OAuth-client (client ID + secret).** Maak in de
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials) een
   OAuth 2.0-client aan van het type "Desktop app" (of "Web application" met
   `http://localhost` als redirect-URI), in een project waar de **Google Ads API** is
   ingeschakeld (API's en services → Bibliotheek → "Google Ads API" → Inschakelen).
   Dit levert `GOOGLE_ADS_CLIENT_ID` en `GOOGLE_ADS_CLIENT_SECRET` op.
3. **Refresh token.** Met die client-gegevens doorloop je één keer de OAuth-toestemming
   als de Google-gebruiker die toegang heeft tot het MCC — bijvoorbeeld met Google's
   eigen [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):
   client ID/secret invullen bij de instellingen (tandwiel rechtsboven, "Use your own
   OAuth credentials"), scope `https://www.googleapis.com/auth/adwords` autoriseren, en
   de playground ruilt de toestemming in voor een refresh token. Die token verloopt
   niet vanzelf (tenzij hij 6 maanden ongebruikt blijft) — bewaar hem als
   `GOOGLE_ADS_REFRESH_TOKEN`.
4. **Account-ids.** `GOOGLE_ADS_LOGIN_CUSTOMER_ID` is het manager-account (het
   10-cijferige id rechtsboven in de Google Ads-interface, zonder streepjes) waarmee je
   inlogt. `GOOGLE_ADS_CUSTOMER_IDS` zijn de losse klantaccounts eronder die
   daadwerkelijk uitgelezen worden — kommagescheiden, optioneel met een leesbare naam
   erachter (`1234567890:Udenhout Trucks,2345678901:Udenhout Bedrijfswagens`); zonder
   naam wordt het kale id gebruikt. Zie `.env.example` voor het exacte format.

Zodra alle zes variabelen gezet zijn (zie de tabel hierboven) pakt `/api/sync-ads` ze
automatisch op bij de volgende cron-run of handmatige aanroep — zonder dat is het een
no-op, net als `/api/sync` zonder `BRONNEN`. De sync haalt telkens de laatste 90 dagen
op voor vier rapporten (campagnes, zoekwoorden, advertentiegroepen, conversies per
conversieactie) en vervangt de bijbehorende tabellen volledig, zelfde filosofie als de
sheet-sync. De vier tabellen zijn al beschreven in `lib/dictionary/tabellen/`
(`googleAdsCampagnes.ts`, `googleAdsZoekwoorden.ts`, `googleAdsAdvertentiegroepen.ts`,
`googleAdsConversies.ts`) en staan al in de lijst in `lib/dictionary/index.ts` — de chat
kan er dus mee praten zodra de tabellen gevuld zijn, zonder verdere code-aanpassingen.

Wil je meer of andere Ads-rapporten (bv. advertenties zelf, apparaattype, locatie),
volg dan hetzelfde patroon: een nieuwe GAQL-query en mapper-functie in
`lib/sync/googleAds.ts`, een nieuwe ruwe tabel + view in een volgende migratie, en een
nieuwe beschrijving in `lib/dictionary/tabellen/`.

## Twee soorten kennis

Belangrijk onderscheid, want ze horen op verschillende plekken thuis:

| | Datawoordenboek | Kennisbank |
|---|---|---|
| Beschrijft | de **vorm** van de data: tabellen, kolommen, wat "verkocht" betekent | de **wereld** die de data beschrijft: welke campagnes bij elkaar horen, waarom een week afwijkt |
| Wijzigt | zelden | wekelijks |
| Staat in | code (`lib/dictionary/`) | de database, tabblad "Kennisbank" |
| Onderhouden door | wie bouwt | de marketeers zelf, zonder deploy |

De kennisbank wordt bij elke vraag aan de systeemprompt toegevoegd, **ná** het
cachebreekpunt. Dat is bewust: stond hij in het gecachete deel, dan zou elke wijziging
van een marketeer de cache van het hele woordenboek weggooien en elke vraag daarna
duurder maken.

Er zit een tekenplafond op (`PROMPT_BUDGET` in `lib/kennisbank.ts`). Bij overschrijding
vallen de oudste items weg en waarschuwt het tabblad daarover — beter een zichtbare
grens dan een chat die ongemerkt duurder en vager wordt.

## Het datawoordenboek

`lib/dictionary/` bevat de kennis die het model krijgt voordat het één query schrijft.
`tabellen/verkopen.ts` is het ingevulde voorbeeld.

De twee velden waar het echt om gaat:

- **`regels`** — de bedrijfsregels. Wat telt als "verkocht"? Welke statussen tellen mee?
  Zijn bedragen inclusief btw? Zijn er historische breuken? Dit staat nergens in de data
  en is precies wat het verschil maakt tussen een query die draait en een query die klopt.
- **`voorbeelden`** — echte vragen met de correcte SQL. Dit is de sterkste kwaliteitsknop
  die je hebt: één goed voorbeeld doet meer dan drie alinea's uitleg.

Ga na een paar weken door `query_log` heen op mislukte queries. Elke mislukking wijst op
kennis die nog niet in het woordenboek staat.

## Wat de chat kan

| Functie | Waar het zit |
|---|---|
| Gesprekken bewaren, hervatten, hernoemen, verwijderen, doorzoeken | `lib/gesprekken.ts`, `app/api/gesprekken/` |
| Automatische gesprekstitel na het eerste antwoord | `lib/vervolg.ts` (draait op Haiku) |
| Vervolgvragen voorgesteld na elk antwoord | idem |
| Grafieken: stat-tegel, staaf, lijn, donut, tabel | `components/chat/Visual.tsx` |
| Opmaak in antwoorden (koppen, lijsten, vet) | `components/chat/Markdown.tsx` |
| Kopiëren, opnieuw beantwoorden, stoppen tijdens het antwoord | `components/DataChat.tsx` |
| Exporteren naar CSV voor Excel | `lib/csv.ts` |
| "Klopt / klopt niet" per antwoord | `app/api/feedback/route.ts` |

### Feedback is je werklijst

De tabel `dataloket.feedback` is geen tevredenheidsmeting. Een antwoord dat als fout is
gemarkeerd wijst bijna altijd op iets wat nog niet in het datawoordenboek staat — een
definitie, een toegestane waarde, een valkuil. Loop die lijst periodiek langs:

```sql
select b.tekst, f.oordeel, f.aangemaakt_op
from dataloket.feedback f
join dataloket.berichten b on b.id = f.bericht_id
where f.oordeel = 'fout'
order by f.aangemaakt_op desc;
```

Hetzelfde geldt voor mislukte queries in `dataloket.query_log`.

## Testen

```bash
npm test        # de SQL-guard (regressietest op de veiligheidsgrens)
npm run typecheck
npm run build
```

## De sync draaien

`vercel.json` zet de nachtelijke cron op 02:00 UTC voor de sheets en 02:15 UTC voor
Google Ads — dat is respectievelijk 03:00/03:15 Nederlandse wintertijd en 04:00/04:15
zomertijd (Vercel-crons draaien altijd in UTC). Handmatig:

```bash
curl -X POST https://<jouw-app>/api/sync -H "Authorization: Bearer $CRON_SECRET"
curl -X POST https://<jouw-app>/api/sync-ads -H "Authorization: Bearer $CRON_SECRET"
```

## Grenzen die in de code vastliggen

Deze zitten in de infrastructuur, niet in de prompt — een taalmodel kan ze niet
wegpraten:

- de rol `dataloket_lezer` heeft alleen `SELECT` op de `v_`-views (migratie)
- elke query draait in een `BEGIN READ ONLY`-transactie met `statement_timeout` van 10s
  (`lib/dataQuery.ts`)
- `guardSql()` laat alleen één enkele `SELECT` door en plakt er een `LIMIT 1000` omheen
  (`lib/sqlGuard.ts`, getest in `lib/sqlGuard.test.ts`)
- het model mag maximaal 6 queries per vraag draaien (`app/api/chat/route.ts`)
