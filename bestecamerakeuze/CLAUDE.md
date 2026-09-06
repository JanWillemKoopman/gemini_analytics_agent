# bestecamerakeuze — Campagnedashboard

Dit document is de doorlopende referentie voor wie hierna aan dit dashboard werkt
(mens of Claude). Het legt vast wat er niet expliciet in elke prompt terugkomt: het
doelplatform en de designvisie waarop het huidige dashboard is gebouwd. Zie
`README.md` voor de technische opzet (stack, data, draaien) en `README-dataloket.md`
voor het aansluiten van Supabase/de chat/de kosten/de aantekeningen/profielen.

## Alleen desktop

Deze app wordt uitsluitend gebouwd en getest voor desktop. Er is bewust **geen**
rekening te houden met mobiel of tablet:

- Geen mobiel navigatiepatroon, geen hamburger-menu, geen responsive breakpoints voor
  kleinere schermen nodig. Ga uit van een breed beeldscherm (laptop/monitor).
- De sidebar is standaard een smalle icoon-rail en klapt op hover uit (zie
  "Structuur van het scherm" hieronder) — dit is een bewuste, permanente desktop-
  interactie, geen responsive/mobiel gedrag en niet iets om terug te draaien naar altijd
  vast-en-breed zonder dat daarom gevraagd wordt.
- De campagnetabel mag zo breed zijn als hij moet zijn; horizontaal scrollen binnen de
  tabel (met sticky eerste kolom) is de oplossing voor veel campagnes, niet het
  verkleinen van de layout voor een smaller scherm.
- Test en itereer visueel op desktop-breedtes (1400–1920px). Besteed geen tijd aan
  mobiele/tablet-varianten tenzij daar expliciet om gevraagd wordt.

## Designvisie van het campagnedashboard

Deze visie is neergezet tijdens de redesign van het campagnedashboard (op basis van een
referentieafbeelding van een premium SaaS-dashboard) en geldt als uitgangspunt voor
nieuwe onderdelen. Kernwoorden: **premium, minimal, automotive, professional,
data-dense but calm.** Geen flashy SaaS-templategevoel, geen overdesign — rust en
duidelijke hiërarchie, niet meer kleur/schaduw/badges dan nodig.

### Structuur van het scherm

- **Sidebar** (donkere, rustige navigatieschil): staat standaard ingeklapt als een
  smalle icoon-rail (72px, `components/Sidebar.tsx`) met alleen het `LogoMark`
  ("AI"-beeldmerk) en de navigatie-iconen; op hover klapt hij uit tot 240px (labels,
  wordmark "Udenhout" en profielnaam faden/schuiven mee in, via Tailwind
  `group`/`group-hover` — geen JS-state nodig) en overlayt hij de content in plaats van
  hem te verschuiven (de aside is absoluut gepositioneerd binnen een vaste 72px-kolom in
  `AppShell.tsx`). Navigatie: Campagnes, Vraag het je data, Kennisbank, Kosten, onderaan
  Instellingen en het gebruikersprofiel. Eén actieve state, subtiel gemarkeerd — geen
  felle kleuren.
- **Geen dubbele navigatie**: de tabbladtitels staan alleen in de sidebar, nooit ook nog
  eens als een rij tabs boven de content.
- **Page header**: paginatitel + korte subtitel links; rechts contextuele status (bv.
  "N campagnes live", "Laatst bijgewerkt HH:MM") en een subtiele update-actie — geen
  grote primaire knop voor een routinehandeling.
- **Filterbalk**: één samenhangend component (aantal + filters + eventueel een inline
  ververs-actie) in plaats van losse knoppen die verspreid op de pagina staan.

### De campagnetabel

- Campagnes blijven **kolommen naast elkaar**, metrics blijven **rijen**; dit patroon
  nooit vervangen door aparte cards per campagne.
- Rijen zijn gegroepeerd in vaste volgorde: **Planning → Budget → Leads → Orders**
  (leads vóór orders, want orders is de laatste stap van de funnel). Groepskoppen zijn
  klein, uppercase en subtiel (geen zware nadruk).
- Sticky eerste kolom (metric-labels) én sticky kolomkoppen (campagnenamen), zodat je
  bij veel campagnes altijd weet naar welke metric en welke campagne je kijkt. Gebruik
  `border-separate` i.p.v. `border-collapse` op tabellen met sticky cellen — anders
  schemeren gescrollde cellen door de sticky cel heen (een Chromium-eigenaardigheid).
- Kolombreedte is bewust smal gehouden zodat zoveel mogelijk campagnes tegelijk
  zichtbaar zijn zonder te hoeven scrollen — ga hier niet zomaar weer breder in tenzij
  de inhoud het echt niet meer toelaat.
- **Geen hover-kleurverandering** in de tabel (bewust verwijderd op verzoek) — de tabel
  reageert niet visueel op muisbeweging.
- Merk wordt getoond als monochroom logo (Volkswagen Groep-merken: Audi, Volkswagen,
  Volkswagen Bedrijfswagens, Škoda, SEAT — zie `components/brandLogos.tsx`) in plaats
  van tekst, zodra het merk herkend wordt. Onbekende of niet-specifieke waarden (zoals
  "Alle") blijven gewoon tekst. Logo's zijn altijd één kleur (`currentColor`), nooit
  multicolor.
- Elke campagnekop heeft een subtiel "aantekeningen"-knopje (zie
  `components/CampaignNotes.tsx`) dat een pop-up opent met learnings voor die campagne
  als oplopende lijst van punten (toevoegen/bewerken/verwijderen). Elk punt toont een
  rond avatarfotootje + naam van wie het toevoegde (`components/Avatar.tsx`,
  `lib/profielen.ts`) — herleidbaarheid is het hele punt van deze feature. Dit knopje
  wordt alleen getoond als Supabase geconfigureerd is — zonder database is er niets om
  in op te slaan.
- Pop-ups (`components/Modal.tsx`) renderen via een React-portal naar `<body>`, niet op
  hun eigen plek in de boom. Reden: een knop die vanuit een sticky tabelkop opent (zoals
  de aantekeningen-knop) zit zelf in een sticky stacking context, en dan wint een hoge
  z-index niet meer van een andere sticky cel elders in de tabel — stacking contexts
  worden alleen met siblings vergeleken, niet globaal. Iets vergelijkbaars gold eerder
  al voor `FilterSelect`'s dropdown (die moest naar `z-40` boven de tabel's `z-30`) en
  voor de tabel zelf (`border-separate` i.p.v. `border-collapse`, zie hieronder) — kom
  je een derde keer zoiets tegen, denk dan eerst aan een portal in plaats van weer een
  hogere z-index te proberen.

### Databestand van de tabel

- **Primaire waarde** (bv. een bedrag of aantal): iets zwaarder gewicht, donkere
  inktkleur.
- **Secundaire regel** eronder: kleiner, gedempte kleur — een afwijking t.o.v. doel in
  mensentaal ("+445 boven doel", "−35 onder doel") in plaats van een kaal percentage
  ("465 (2325%)"). Groen voor positief, rood voor negatief — altijd gedempt, nooit
  neonkleurig.
- **Progress bars** alleen tonen als er een echte doelwaarde is; anders een neutrale
  "—". Bars zijn klein, dun, afgeronde uiteinden.
- Nederlandse getalnotatie overal (`nl-NL`, punt als duizendtal, komma als decimaal).

### Kleuren, typografie, spacing

- Design tokens staan in `app/globals.css` (`@theme` blok, Tailwind v4): elke
  `--color-*`, `--radius-*` en `--shadow-*` token genereert automatisch de
  bijbehorende utility (`--color-surface-tint` → `bg-surface-tint`, enzovoort). Voeg
  nieuwe kleuren als token toe in plaats van losse arbitrary-waardes (`bg-[#fbfaf8]`)
  door de code te verspreiden.
- Basispalet: warme, bijna-witte paginakleur (`--color-page`) achter witte kaarten
  (`--color-card`), donkere navy sidebar, gedempte grijstinten voor secundaire tekst,
  zachtgroen/rood alleen voor status en afwijkingen. Geen gradients, geen
  glassmorphism, geen overdaad aan blauwe vlakken.
- Borders zijn extreem subtiel (`--color-line`, `--color-line-soft`) — gebruikt om
  structuur te geven (tabelgroepen, cards, controls), niet om elke cel zwaar te
  omlijnen.
- Radius-systeem: `--radius-control` (8–10px) voor knoppen/inputs, `--radius-card`
  (16px) voor cards, `--radius-panel` (20px) voor grotere panelen, `--radius-pill` waar
  semantisch een pil-vorm past (zoals de inlogknop) — niet overal pillvormig maken.
  Shadows zijn subtiel (`--shadow-card`, `--shadow-dropdown`), nooit een zware
  drop-shadow.
- Typografie: `TheSansB` (huisstijl) met Inter als geladen fallback via
  `next/font/google`. Sectiekoppen (zoals "PLANNING") zijn klein, uppercase, met iets
  verhoogde letter-spacing en gedempt — ondersteunend, niet dominant.

### Component- en codepatronen

- Herbruikbare, kleine componenten per concern:  `Sidebar`, `NavigationItem`,
  `PageHeader`, `LiveStatus`, `UpdateButton`, `FilterBar`, `FilterSelect`,
  `CampaignTable`, `CampaignHeader`, `MetricCell`/`PlainCell`, `ProgressBar`,
  `StatusIndicator`, `Modal`, `CampaignNotes`, `Avatar`, `brandLogos`. Voeg nieuwe UI
  eerder toe als zo'n klein, getypeerd component dan als opgeblazen JSX in een
  paginabestand.
- Eén icon-set (`components/icons.tsx`): simpele, consistente line-icons met
  `stroke="currentColor"`. Geen emoji, geen mix van iconstijlen, geen los icon-pakket
  voor een handvol glyphs — alleen wanneer een merklogo echt een getrouwe vector nodig
  heeft (zie `brandLogos.tsx`, gebaseerd op het MIT-gelicenseerde simple-icons-project)
  wordt daarvan afgeweken.
- Features die Supabase nodig hebben volgen het bestaande patroon: een tabel in
  `supabase/migrations/000N_*.sql` met RLS ("gedeeld, niet per gebruiker" tenzij het
  echt persoonlijk is), een `lib/*.ts` data-access-bestand, `app/api/*/route.ts`
  route-handlers die `getGebruiker()` checken vóór elke schrijfactie, en een client-UI
  die netjes degradeert (inlogprompt, of — als de functie sowieso niet beschikbaar is
  omdat Supabase niet geconfigureerd is — helemaal niet renderen) in plaats van te
  crashen. Zie `lib/kennisbank.ts` / `lib/campagneNotities.ts` / `lib/profielen.ts` als
  voorbeeld.
- Inloggen is e-mailadres + wachtwoord (geen magic link, geen zelfregistratie):
  accounts worden aangemaakt door iemand met toegang tot Supabase, of via
  `scripts/maak-gebruiker.ts` (draait los van de app met de service role-sleutel — zie
  README-dataloket.md). Elke collega stelt zelf zijn naam en avatarfoto in bij
  **Instellingen** (`components/instellingen/`); de foto gaat rechtstreeks van de
  browser naar Supabase Storage (bucket `avatars`, rijbeveiligd op de eigen user-id als
  mapnaam), niet via een API-route.
- De campagnedata zelf (Google Sheet via `lib/sheet.ts`) blijft de brondata; features
  die daar bovenop komen (aantekeningen, kosten) koppelen op de campagnenaam of draaien
  los ernaast — er komt geen eigen "campagne"-tabel in de database zolang de sheet de
  bron blijft.
