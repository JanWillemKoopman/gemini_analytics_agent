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
  `AppShell.tsx`). Bovenaan staan, los en zonder groepskopje, **Scores** en **Kennis en
  acties** — wat het team zelf vastlegt komt vóór de cijfers, en de stand komt vóór de
  inhoud omdat de weekstand de aanleiding is om iets vast te leggen. Daaronder staat de
  navigatie in twee
  groepen onder een klein, uppercase groepskopje (net als de "Planning"/"Budget"-
  groepskoppen in de campagnetabel): **Campagnes** (Campagnes, Tijdlijn) en **Chatbot**
  (Start gesprek, Prikbord, Kennisbank) — het Prikbord staat bewust onder Chatbot, want
  het is een functie van de chat (grafieken die je daaruit vastpint), niet van het
  wekelijkse cijferoverzicht.
  Onderaan, buiten de groepen: Kosten, Instellingen en het gebruikersprofiel. Eén actieve
  state, subtiel gemarkeerd — geen felle kleuren.
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
  Volkswagen Bedrijfswagens, Škoda, SEAT, plus Porsche en Bentley — zie
  `components/brandLogos.tsx`) in plaats van tekst, zodra het merk herkend wordt.
  Onbekende of niet-specifieke waarden (zoals "Alle") blijven gewoon tekst. Logo's
  zijn altijd één kleur (`currentColor`), nooit
  multicolor.
- Elke campagnekop opent het **besluitenlogboek** van die campagne op twee gelijkwaardige
  manieren: een klik op de campagnenaam zelf, of het subtiele "logboek"-knopje ernaast
  (`components/CampaignNotes.tsx`). Beide openen dezelfde zijbalk (`components/
  Drawer.tsx`) die van rechts uitklapt over de volle schermhoogte en ongeveer een derde
  van de breedte, met `components/notities/NotitieLijst.tsx` erin — die open-state leeft
  daarom op één plek, in `components/CampaignHeader.tsx`. Dit is de **enige** plek in het
  dashboard waar aantekeningen worden toegevoegd of bekeken; er is bewust geen los paneel
  onder de tabel meer (de vroegere "Focusmodus" is vervangen door deze zijbalk). Elke
  regel in het logboek is een observatie, hypothese, besluit of actie (`lib/notities.ts`),
  met een avatarfotootje + naam van wie hem toevoegde (`components/Avatar.tsx`,
  `lib/profielen.ts`) — herleidbaarheid is het hele punt. Het invoerveld staat bovenaan
  (bewust duidelijk: dat is waar je typt), de lijst eronder toont nieuw-naar-oud. Bij een
  hypothese of besluit vraagt de UI om de metriek die erdoor moet veranderen en legt hij
  de stand van dat cijfer op dát moment vast; de regel eronder toont later "toen → nu" met
  het verschil. Zonder dat nulpunt (oudere aantekeningen) wordt er niets verzonnen, dan
  blijft alleen de metrieknaam staan. Acties zijn af te vinken. De naam is alleen
  klikbaar en het knopje verschijnt alleen als Supabase geconfigureerd is — zonder
  database is er niets om in op te slaan.
- **"Zo lees je dit"** (knop in de filterbalk, standaard uit): zet een leeswijzer boven
  de tabel en een zin in gewone taal onder elk metriclabel. Die uitleg staat als veld
  `uitleg` op elke metric in `CampaignTable.tsx` — een nieuwe rij toevoegen zonder
  uitleg valt daardoor meteen op.
- Pop-ups (`components/Modal.tsx`) en de uitklapbare zijbalk (`components/Drawer.tsx`)
  renderen via een React-portal naar `<body>`, niet op hun eigen plek in de boom. Reden:
  een knop die vanuit een sticky tabelkop opent (zoals de aantekeningen-knop) zit zelf
  in een sticky stacking context, en dan wint een hoge z-index niet meer van een andere
  sticky cel elders in de tabel — stacking contexts worden alleen met siblings
  vergeleken, niet globaal. Iets vergelijkbaars gold eerder al voor `FilterSelect`'s
  dropdown (die moest naar `z-40` boven de tabel's `z-30`) en voor de tabel zelf
  (`border-separate` i.p.v. `border-collapse`, zie hieronder) — kom je een derde keer
  zoiets tegen, denk dan eerst aan een portal in plaats van weer een hogere z-index te
  proberen.

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
  Cijfers in een tabel lijnen uit: `font-variant-numeric: tabular-nums` staat in
  `globals.css` op `table` — bewust niet op `body`, want in lopende tekst zijn
  tabellaire cijfers juist te wijd.
- De ondersteunende regel onder een waarde gebruikt `text-meta` (eigen maat plus
  regelafstand), niet `text-xs`.

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
- Radius-systeem: `--radius-control` (8–10px) voor kleine controls, `--radius-button`
  voor knoppen en invoervelden (de vorm die per merk het sterkst verschilt: pil bij
  Udenhout/Volkswagen, 4px bij Porsche, 0 bij CUPRA), `--radius-card` (16px) voor
  cards, `--radius-panel` (20px) voor grotere panelen, `--radius-pill` alleen waar een
  vorm echt altijd een pil is (de progress bar) — niet overal pillvormig maken.
  `--radius-avatar` voor avatars en het beeldmerk (rond bij de merken met een ronde
  vormtaal, hoekig bij Porsche/CUPRA/Bentley). Shadows zijn subtiel en lopen in vier
  hoogtes (zie "Themes" hieronder), nooit een zware drop-shadow.
- Typografie: `TheSansB` (huisstijl) met Inter als geladen fallback via
  `next/font/google`. Sectiekoppen (zoals "PLANNING") zijn klein, uppercase, met iets
  verhoogde letter-spacing en gedempt — ondersteunend, niet dominant. Lettergroottes
  lopen via tokens (`--text-xs/sm/base` plus `--text-label`, `--text-cell`,
  `--text-title`), niet via arbitrary waardes als `text-[15px]` — anders kan een theme
  ze niet verzetten.
- Tekst bovenop een gekleurd vlak: `text-on-primary` (niet `text-white`) en
  `text-on-logo` voor het "AI"-beeldmerk. Niet elk merk heeft een donkere primaire
  kleur: op Škoda's Electric Green en CUPRA's koper hoort juist donkere tekst.

### Themes (het oogje rechtsboven)

Rechtsboven in het scherm staat een oog-icoon (`components/ThemeSwitcher.tsx`) waarmee
je de vormgeving van het hele dashboard omzet: de huisstijl van Udenhout zelf, of die
van Volkswagen, Audi, Škoda, SEAT, CUPRA, Porsche, Pink Porsche of Bentley.

Eén theme is geen automerk maar één auto: **Pink Porsche** is de lichtroze 911 GT3 RS —
dezelfde technische vormtaal als het Porsche-theme (Barlow, 4px-radii, het raster, het
korte bewegingsritme), maar met een roze studiovlak, zwart als inkt- en navigatiekleur en
magenta (#d5006e) als enige accent. Hij hergebruikt bewust het Porsche-font en het
Porsche-logo (sleutel `pink-porsche` in `brandLogos.tsx`): het is dezelfde auto, andere
lak.

- **Hoe het werkt.** `components/ThemeProvider.tsx` zet `data-theme="…"` op `<html>` en
  bewaart de keuze in localStorage; een klein inline script in `app/layout.tsx` zet dat
  attribuut al vóór de eerste paint, zodat je geen flits van het standaardtheme ziet.
  Per theme staat er in `app/globals.css` een `[data-theme="…"]`-blok dat de tokens
  overschrijft. Die blokken staan bewust **buiten** `@layer`: Tailwind zet zijn eigen
  tokens in `@layer theme`, en ongelaagde CSS wint altijd van gelaagde CSS.
- **Per gebruiker onthouden.** Voor een ingelogde collega staat de keuze ook op zijn
  profiel (`dataloket.profielen.theme`, `supabase/migrations/0010_profiel_theme.sql`),
  naast naam en avatar (zie `lib/profielen.ts`, `app/api/profiel/route.ts`). localStorage
  blijft de bron vóór de eerste paint en voor wie niet ingelogd is; `ThemeProvider` haalt
  het profieltheme daarna async op en neemt het over als het afwijkt (net als elders in
  de app een profielveld pas na een fetch verschijnt — een korte flits van het
  lokale/standaardtheme is dus mogelijk), en schrijft bij `kiesTheme` zowel naar
  localStorage als (best-effort, ook zonder sessie) naar `/api/profiel`. Zo geldt de
  keuze ook op een ander apparaat of na opnieuw inloggen.
- **Waarom het overal werkt.** Elk component gebruikt uitsluitend de semantische tokens
  (`bg-card`, `text-ink`, `border-line`, `rounded-button`, `font-sans-w7`, …). Zolang
  dat zo blijft, hoeft nieuwe UI niets van themes te weten en verandert hij vanzelf
  mee. Een hardgecodeerde `bg-[#ffffff]` of `text-white` breekt precies dat.
- **Een theme is meer dan kleur.** Font, lettergrootte, letterspatiëring, kapitalen,
  hoekradius en schaduw horen er net zo goed bij; een theme dat alleen kleuren verzet
  ziet er niet uit als dat merk. De typografische eigenschappen die geen Tailwind-
  utility hebben (`--theme-title-*`, `--theme-label-*`, `--theme-body-tracking`) worden
  toegepast via de classes `.titel-theme` en `.label-theme`.
- **Ook ondergrond, beweging en vorm zijn merkeigen.** Naast kleur en typografie verzet
  een theme:
  - `--theme-page-patroon` (+ `-maat`): één textuur op het paginavlak — een technisch
    raster bij Porsche, diagonale hairlines bij CUPRA, het knurling-ruitje bij Bentley,
    een licht verloop bij Volkswagen/Audi/Škoda, drukkorrel (inline SVG-ruis) bij
    Udenhout en SEAT. Houd het bij **één** signaal per merk: patroon én korrel én
    verloop tegelijk maakt het onrustig in plaats van rijk. De class staat zowel op
    `body` als op `.pagina-vlak` (de schil in `AppShell` legt een eigen achtergrond over
    de body heen).
  - `--theme-sidebar-verloop` (`.sidebar-vlak`): verloop over de donkere navigatieschil.
  - `--duur-snel` / `--duur` / `--duur-traag` + de utility `ease-merk`: beweging hoort
    bij het merk (Porsche en CUPRA kort en abrupt, Bentley traag en zwaar). Gebruik
    `duration-[var(--duur-snel)] ease-merk` in plaats van een vaste `duration-150`.
    `--duur-adem` doet hetzelfde voor de ademende statusdot.
  - Vier schaduwhoogtes: `--shadow-subtle` (rustend paneel) → `--shadow-card` (het
    dragende paneel) → `--shadow-raised` (onder de muis) → `--shadow-dropdown` /
    `--shadow-modal`. Op de donkere themes zit in die tokens een inset-haarlijn licht
    op de bovenrand: op zwart komt diepte van licht, niet van schaduw — en omdat het in
    de token zelf zit, hoeft geen enkel component ervan te weten.
  - `.kaart-accent` (accentlijn bovenop een dragend paneel; een **border**, want die kan
    niet door een sticky tabelkop worden overdekt), `.kaart-omlijst` (de gouden
    binnenlijn van Bentley, elders transparent), `.kaart-hover` (een fractie omhoog bij
    hover — nooit in de campagnetabel, die reageert bewust niet op muisbeweging) en
    `.laadvlak` (glans over een laadvlak in de merkkleur).
  - `--theme-nav-radius` / `--theme-nav-streep`: de vorm van het actieve item in de
    sidebar (pil bij Volkswagen, streep links bij Porsche en CUPRA, gouden haarlijn bij
    Bentley) en `--theme-progress-maatstreep` voor de maatstreepjes in de progress bar.
  - `--color-selectie` (geselecteerde tekst), `--focus-ring*`, `--radius-avatar` en
    `--scrollbar-dikte`: kleine dingen die in élk theme kloppen moeten, anders valt juist
    daar het browserblauw of een ronde avatar uit de toon.
- **Het merklogo staat in beeld.** Staat het dashboard in de vormgeving van een automerk,
  dan toont `LogoMark` in de sidebar het logo van dat merk (opgezocht in
  `brandLogos.tsx`, want de theme-id's zijn dezelfde sleutels) in plaats van het
  auto-icoon; hetzelfde logo staat in het themamenu. Udenhout en CUPRA houden het
  auto-icoon — voor CUPRA zit er (nog) geen logo in de set.
- **De themewissel vloeit over.** `kiesTheme` draait de wissel door
  `document.startViewTransition` als de browser dat kent en de gebruiker geen
  `prefers-reduced-motion` heeft staan; anders wisselt het theme gewoon direct. Het is
  dus altijd een toevoeging op het gewone pad, nooit een voorwaarde.
- **Twee donkere themes** (Audi en CUPRA) draaien het hele scherm om. Controleer bij
  nieuwe UI dus altijd even één van die twee: een vlak dat alleen op wit getest is,
  valt daar door de mand.
- **Fonts.** De huisstijlletters van de merken zijn geen van alle vrij te gebruiken; in
  `app/layout.tsx` staat per merk de dichtstbijzijnde vrije benadering (DM Sans, Archivo,
  Manrope, Fira Sans, Saira, Barlow, Jost + Cormorant Garamond) met een toelichting
  waaróm die is gekozen. Ze laden met `preload: false`, zodat een bezoeker alleen het
  font van zijn eigen theme binnenhaalt.
- **Grafieken** kunnen geen CSS-variabelen lezen (Recharts zet kleuren als
  SVG-attribuut), dus het palet per theme staat in `lib/themes.ts` en wordt opgehaald
  met `useGrafiekKleuren()`. Daar staat niet alleen kleur maar ook vorm: `lijndikte`,
  `lijnvorm` (vloeiend of recht), `punt` (gevuld, open of vierkant) en `staafradius` —
  Bentley tekent een haarlijn met een open ring, Porsche en CUPRA recht met een vierkant
  punt, Volkswagen dikke pilvormige staven. Nieuw theme = een blok in globals.css + een regel in
  `lib/themes.ts`; verder hoeft er niets te veranderen.

### Component- en codepatronen

- Herbruikbare, kleine componenten per concern:  `Sidebar`, `NavigationItem`,
  `PageHeader`, `LiveStatus`, `UpdateButton`, `FilterBar`, `FilterSelect`,
  `CampaignTable`, `CampaignHeader`, `MetricCell`/`PlainCell`, `ProgressBar`,
  `StatusIndicator`, `Modal`, `Drawer`, `Toast`, `CampaignHeader`, `CampaignNotes`,
  `NotitieLijst`, `Prikbord`, `CampagneTijdlijn`, `Avatar`, `Medaille`, `Inlogprompt`,
  `brandLogos`, `kennisacties/*`, `scores/*`. Voeg nieuwe UI
  eerder toe als zo'n klein, getypeerd component dan als opgeblazen JSX in een
  paginabestand.
- Het oogje voor de themes hangt `fixed` rechtsboven in het scherm (niet in de
  PageHeader), zodat het op elk tabblad en tijdens scrollen op dezelfde plek staat; de
  `<main>` houdt daarvoor rechts ruimte vrij (`pr-16`).
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

## Het weekoverleg als uitgangspunt

Het dashboard bestaat niet om mooi te zijn maar om één ritueel te dragen: het team kijkt
wekelijks samen naar de campagneresultaten en beslist op basis daarvan. Nieuwe
functionaliteit hoort die cyclus te versterken — beeld → besluit → terugblik → zichtbare
verandering — en niet alleen een cijfer extra te tonen. Wat daar nu voor staat:

- **Besluitenlogboek** per campagne (soort + gekoppelde metriek + nulpunt), zodat een
  besluit volgende week naast het cijfer staat dat het moest raken. Het logboek is één
  zijbalk die vanuit de campagnenaam of het logboek-knopje opent — omdat het overleg per
  campagne gaat en niet per metric.
- **Kennis en acties** (`components/kennisacties/`, tweede tabblad): hetzelfde logboek,
  maar dan over alle campagnes heen — datum, initialen, campagne, soort en de tekst in
  één tabel, met daarboven dezelfde velden als filter. De logboekzijbalk is voor tijdens
  het kijken naar één campagne; dit tabblad is voor de vraag "wat hebben we de afgelopen
  weken eigenlijk geleerd?".
  - Er komt **geen tweede tabel** voor in de database: het leest en schrijft
    `dataloket.campagne_notities` via dezelfde POST-route als het logboek zelf. Dat geldt
    ook voor alles op het scoretabblad hieronder — punten, weken, streaks en prijzen zijn
    zonder uitzondering afgeleid uit diezelfde rijen, er wordt niets van bijgehouden.
  - Een bericht hoeft niet aan een campagne te hangen. In het uitklapmenu staat naast de
    campagnes uit de sheet één extra optie ("Eigen onderwerp") met een vrij tekstveld;
    zo'n naam bestaat niet in de sheet en komt daardoor nergens bij de campagnes te
    staan — in de tabel is hij herkenbaar als "vrij onderwerp". Geen extra kolom, geen
    vlag: de koppeling op naam regelt het al.
  - Toevoegen gaat via een **zijbalk** die van rechts inschuift (`Drawer.tsx`), met
    dezelfde indeling als het logboek bij Campagnes: het invulgedeelte bovenaan, de al
    vastgelegde berichten eronder. Geen gecentreerde pop-up — die legt zich over de tabel
    waar je tijdens het typen nog in staat te kijken. Na opslaan blijft de zijbalk open en
    leegt alleen het tekstveld (campagne en soort blijven staan): het nieuwe bericht
    verschijnt meteen bovenaan in de lijst eronder, en je kunt er zo nog een kwijt. De
    zijbalk zelf hangt in `AppShell`, niet in een paneel: hij wordt vanaf beide teamtabs
    geopend (de ronde "+" rechtsonder) én vanuit de nudge in het scorebord. Na opslaan
    verschijnt er rechtsonder een korte bevestiging met de verdiende punten
    (`components/Toast.tsx`) — feedback hoort te vallen op het moment van de handeling,
    niet pas als je een ander tabblad opent.
  - Onder de berichtentabel staat een aparte **actietabel** (`ActieTabel.tsx`) met alleen
    de berichten van het soort "actie", af te vinken zonder eerst de campagne op te
    zoeken. Open acties staan bovenaan met hun leeftijd in dagen (rood vanaf veertien
    dagen), afgeronde blijven onderaan staan als bewijs dat er iets gebeurd is. Daarboven
    staat per collega hoeveel er openstaat en hoe oud de oudste is (`OpenActies.tsx`) —
    de toewijzing is die van wie de actie noteerde, want een eigenaar kent de tabel niet,
    en dat staat er ook zo bij. Bewust géén punten: een openstaande actie is geen score
    maar een schuld aan het team. De actietabel volgt dezelfde filterbalk, maar negeert
    het filter "Type bericht" — daar staan per definitie alleen acties in.

- **Scores** (`components/scores/`, `lib/punten.ts`, `lib/week.ts`, bovenste tabblad):
  alles rondom de puntentelling, van boven naar beneden: het teamdoel van deze week, de
  rij collega's met hun punten over 30/90 dagen of alles, de weekstand, en de totaalstand
  zonder einddatum. De inhoud van wat er vastligt staat op het tabblad hiervoor; hier gaat
  het over het ritme.
  - **Punten per bericht**: observatie 10, hypothese 20, besluit 10, actie 5. De weging
    volgt hoe zwaar een aantekening weegt in het overleg, niet hoeveel typewerk hij kost.
  - **De puntenweek loopt van maandag 11:59 tot maandag 11:59** Nederlandse tijd
    (`lib/week.ts`, met tests voor zomer-/wintertijd). Dat ene moment bepaalt drie dingen
    tegelijk: welke berichten meetellen voor de weekpunten, wanneer #1/#2/#3 opnieuw
    verdeeld worden, en tot hoe laat de weekwinnaar-pop-up nog te zien is. Verzet dat
    moment dus nooit op één plek.
  - **Een winnaar per week is hier bewust wél de bedoeling** — dat was eerder anders (het
    scorebord was expliciet géén ranglijst). De weekstand is daarom op punten gesorteerd
    en deelt medailles uit; de rij collega's erboven blijft **alfabetisch** en zonder
    medaille, zodat je een collega altijd op dezelfde plek terugvindt en een rustige maand
    niet meteen een plek op een ranglijst is. Iedereen met een account staat erop, ook wie
    nog niets heeft vastgelegd — die lege nul is de uitnodiging, en voor jezelf staat er
    een knop bij om er iets aan te doen. Gelijke stand deelt dezelfde plek en nul punten
    levert nooit een medaille op (`bepaalMedailles`). De medaillekleuren zijn eigen tokens
    die in élk theme gelijk blijven: goud in het merkpalet van Škoda is geen goud meer.
  - **Teamdoel** bovenaan (`Teamdoel.tsx`): 30 punten per collega per week, dus het doel
    schaalt mee als er iemand bij komt. Coöperatief en vóór de individuele stand: een
    achterblijvende week hoort een probleem van het team te zijn, niet van één collega.
  - **Streaks**: elke week op rij waarin je iets vastlegt vanaf de tweede levert
    `STREAK_BONUS` (30) bonuspunten op in díe week; een week overslaan zet de reeks terug
    op nul. De eerste week van een reeks geeft niets — anders is "een streak" gewoon een
    andere naam voor "een bericht".
  - **Totaalstand zonder einddatum** (`Prijzenkast.tsx`): alle punten sinds het eerste
    bericht plus de prijzenkast (hoe vaak #1, #2, #3). Een prijs telt pas mee zodra de
    week is afgelopen — een voorsprong op donderdag is nog geen gewonnen week.
  - **Weekwinnaar-pop-up** (`WeekwinnaarPopup.tsx`): maandag tussen 00:00 en 11:58, dus
    in het laatste stuk van de week die om 11:59 afsluit. Weg te klikken; de keuze staat
    per collega en per week in localStorage, zodat hij maandag daarop vanzelf terugkomt.
    Hij hangt in `AppShell` en rendert via een portal, dus hij verschijnt ook als je die
    ochtend meteen naar de campagnes doorklikt — en hij blijft weg als er die week niets
    is vastgelegd.
  - **Eén ophaalactie voor beide tabbladen** (`lib/teamData.tsx`): ze kijken naar dezelfde
    rijen, dus een tweede fetch zou twee standen opleveren die na het vastleggen van een
    bericht uit elkaar lopen. Het peilmoment (`nu`) tikt daar elke minuut door, zodat de
    week vanzelf omslaat zonder herladen.
- **Prikbord** (`components/prikbord/`, `lib/prikbord.ts`): grafieken uit de chat die het
  team bewaart, met hun query erbij en een ververs-knop die dezelfde SQL opnieuw draait.
  Zo groeit het dashboard uit de vragen die er echt leven.
- **Vraagbibliotheek** op het chat-startscherm (`lib/vraagbibliotheek.ts`): de vragen die
  collega's het vaakst stelden, geaggregeerd en zonder namen — leermiddel, geen ranglijst.
- **Verantwoording onder elk antwoord** (query, rijen, duur, kopieerknop): vertrouwen in
  de cijfers is de voorwaarde om er beslissingen op te durven baseren.
- **"Zo lees je dit"**: data-gedreven werken struikelt vaker over onbegrip dan over onwil.

Nieuwe features die hierbij horen (weekbriefing, terugblik op vorige week, vergelijking
met vorige week, anomaliedetectie) passen in ditzelfde patroon: de sheet blijft de bron,
Supabase draagt wat het team zelf vastlegt.
