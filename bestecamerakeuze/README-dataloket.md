# Het dataloket — aansluiten

Het chattabblad ("Vraag het je data") is gebouwd maar staat uit tot de omgeving is
aangesloten. Zolang dat niet zo is, blijft het campagne-tabblad gewoon werken en toont
het chattabblad welke variabelen nog ontbreken.

Onderstaande stappen zijn eenmalig.

## 1. Migraties draaien

Voer in volgorde uit in de Supabase SQL-editor:
`supabase/migrations/0001_dataloket.sql`, dan `0002_gesprekken.sql`, dan
`0003_kennisbank.sql`, dan `0004_claude_kosten.sql`, dan `0005_campagne_notities.sql`,
dan `0006_profielen.sql`, dan `0007_besluitenlog_prikbord_vragen.sql`.

De eerste zet de datalaag en de read-only rol neer, de tweede de gespreksgeschiedenis
(gesprekken, berichten, feedback — elk met rijbeveiliging zodat iedereen alleen zijn
eigen gesprekken ziet), de derde de kennisbank, de vierde de registratie van Claude
API-kosten (voedt het Kosten-tabblad; begint te vullen zodra de migratie draait, geen
historie van ervoor), de vijfde de aantekeningen/learnings per campagne (voedt de
aantekeningen-pop-up op het campagnedashboard — die knop verschijnt pas zodra Supabase
geconfigureerd is, ongeacht de andere twee dataloket-variabelen hieronder), de zesde de
naam + avatarfoto per collega (inclusief de `avatars`-bucket in Supabase Storage) — voedt
zowel Instellingen als de naam/foto bij elke aantekening. De zevende maakt van de
aantekeningen een besluitenlogboek (soort + gekoppelde metriek per aantekening), voegt
het prikbord toe (vastgepinde grafieken uit de chat) en de view
`v_populaire_vragen` waar de vraagbibliotheek op het chat-startscherm uit leest.

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
| `CHAT_MODEL` | optioneel: het model van de chat (standaard `claude-haiku-4-5`) |
| `SYNC_DATABASE_URL` | schrijvende verbinding, alleen voor de sync-job |
| `CRON_SECRET` | beschermt `/api/sync` tegen aanroepen van buiten |
| `SUPABASE_SERVICE_ROLE_KEY` | alleen voor `scripts/maak-gebruiker.ts`, nooit in de app zelf — zie hieronder |

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
| Verantwoording (query + rijen + duur) onder élk antwoord | `Verantwoording` in `components/DataChat.tsx` |
| Antwoord vastpinnen op het prikbord | `lib/prikbord.ts`, `app/api/prikbord/` |
| Vraagbibliotheek: waar het team het vaakst naar vraagt | `lib/vraagbibliotheek.ts`, `app/api/vragen/` |

### Het prikbord

Een vastgepind antwoord bewaart zijn eigen query én de uitkomst van dat moment. Het
prikbord-tabblad toont die momentopname met de datum erbij; "verversen" draait dezelfde
SQL opnieuw — langs dezelfde drie grenzen als de chat (guard, read-only rol, read-only
transactie met timeout, zie `lib/dataQuery.ts`), want SQL uit de database is niet
vertrouwder dan SQL uit het model. Het bord is gedeeld: iedereen ziet hetzelfde.

### De vraagbibliotheek

De querylog blijft per gebruiker afgeschermd; de bibliotheek leest alleen de
geaggregeerde view `dataloket.v_populaire_vragen` (vraag, aantal, laatst gesteld — geen
gebruiker-id). Het doel is dat nieuwe collega's zien welke vragen zinvol zijn, niet dat
iemand kan meekijken.

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

`vercel.json` zet de nachtelijke cron op 02:00 UTC — dat is 03:00 Nederlandse wintertijd
en 04:00 zomertijd (Vercel-crons draaien altijd in UTC). Handmatig:

```bash
curl -X POST https://<jouw-app>/api/sync -H "Authorization: Bearer $CRON_SECRET"
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
