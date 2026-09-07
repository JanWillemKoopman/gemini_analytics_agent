# Campagnedashboard

Live dashboard dat campagnedata toont uit een publiek Google Sheet (tabblad "Campagnes").
Losstaand Next.js 15-project binnen deze repo — eigen `package.json`, eigen build, geen
gedeelde code met de mmm-wizard app in de root.

Draait op dezelfde plek (Vercel-project, domein, root directory) als de vorige
bestecamerakeuze-site, die deze functionaliteit volledig vervangt.

**Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · TypeScript

## Draaien

```bash
cd bestecamerakeuze
npm install
npm run dev            # http://localhost:3002
```

Verificatie:

```bash
npm run typecheck
npm run build
```

## Data

`lib/sheet.ts` haalt het tabblad "Campagnes" op via de publieke gviz-CSV-export van
Google Sheets (`.../gviz/tq?tqx=out:csv&sheet=Campagnes`) — geen API-key nodig omdat de
sheet op "Anyone with the link can view" staat. De pagina is `force-dynamic`
(`app/page.tsx`): elk bezoek haalt de actuele data live op, er wordt niets gecachet of
gegenereerd tijdens de build.

De sheet-ID staat als fallback in `lib/sheet.ts` en is overschrijfbaar via de
env-variabele `GOOGLE_SHEET_ID`, mocht het dashboard ooit naar een andere spreadsheet
moeten wijzen.

**Bedragen en aantallen** in de sheet staan in NL-notatie (`€ 3.000`, `20,00`); zie
`parseNumberNL` in `lib/sheet.ts`.

## Dashboard

`components/CampaignMatrix.tsx` toont de campagnes getransponeerd in één tabel: elke
campagne is een kolom (met merk-badge en status-badge — groen "Open", grijs "Gesloten"),
de metrics staan eronder als rijen, in deze volgorde:

**Planning:** Startdatum, Einddatum
**Budget:** Budget (percentage benut erachter), Uitgaven (restant of overschrijding erachter)
**Leads:** Doel leads, Leads (percentage van doel behaald erachter), Online leads
**Orders:** Doel orders, Orders (afwijking t.o.v. doel erachter)

Percentages komen uit `ratio`/`formatPercent`/`withPercent` in `lib/format.ts` en vallen
terug op enkel de hoofdwaarde zodra teller of noemer ontbreekt. Rijen toevoegen is een kwestie van een item (label + uitleg + render) toevoegen aan
de juiste groep in de `GROUPS`-array in `components/CampaignTable.tsx`.

De campagnes staan altijd gesorteerd op startdatum, hoogste (meest recente) links
(`sortByStartdatumDesc` in `CampaignDashboard.tsx`) — geen aparte sorteerkeuze in de UI.

## Filters

`components/CampaignDashboard.tsx` (client component) filtert client-side op Status,
Merk, Ordersoort en Klantgroep (kolom "Klantgroep orders (indien van toepassing)" in de
sheet, afgekort in de UI) via de generieke multi-select `components/FilterDropdown.tsx`,
rechtsboven de tabel. Filteropties worden afgeleid uit de data zelf, dus nieuwe waarden
in de sheet verschijnen automatisch als filteroptie.

## Merkidentiteit

Huisstijl in `app/globals.css`, overgenomen uit screenshots van udenhout.nl (het domein
zelf is in deze sandbox geblokkeerd, dus niet direct geraadpleegd): bijna-zwarte
donkerblauw (`--color-brand: #101a2c`) voor tekst/badges/actieve filters, witte
paginaachtergrond, volledig afgeronde ("pil") filterknoppen (`--radius-pill`) en een
grotere afronding op kaarten/panelen (`--radius-card: 16px`) met een zachte schaduw
(`--shadow-card`), net als op hun site. Lettertype is Inter (`next/font/google`, zie
`app/layout.tsx`) — geen exacte match met het merklettertype, wel visueel vergelijkbaar.
Pas de tokens in `app/globals.css` aan zodra je de echte merkkleuren/huisstijlgids hebt.

## Laadstatus

`app/loading.tsx` toont skeleton-placeholders (titel, filterbalk, tabel) terwijl
`getCampagnes()` in `app/page.tsx` de sheet ophaalt — automatisch via Next.js' `loading`
conventie, geen extra state nodig.

## Bekende punten

- Geen Supabase meer nodig: de vorige camerakeuze-site gebruikte het `camerakeuze`-schema
  in het gedeelde Supabase-project van deze repo, maar dit dashboard leest rechtstreeks
  en live uit de sheet. Het schema zelf is niet aangepast/verwijderd.
- De kolommen "Order totaal" en "Orders campagne" in de sheet lijken voor elke campagne
  dezelfde waarde te bevatten (een totaal i.p.v. een per-campagne cijfer). Zolang dat zo
  is, kan het "Orders"-percentage op een kaart en de KPI "Behaalde orders" onrealistisch
  hoog uitvallen. Dit is een datakwestie in de sheet, geen bug in het dashboard.
