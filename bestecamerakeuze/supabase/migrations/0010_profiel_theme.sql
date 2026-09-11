-- Vormgevingskeuze (het oogje rechtsboven, zie components/ThemeSwitcher.tsx) per
-- collega, zodat die blijft gelden zodra iemand op een ander apparaat of in een andere
-- browser inlogt — tot nu toe stond de keuze alleen in localStorage, dus per browser.
--
-- Nullable: geen waarde betekent "nog niet gekozen", dan blijft de localStorage-/
-- standaardwaarde gelden (zie ThemeProvider.tsx). Bewust geen check-constraint op de
-- lijst met theme-id's — die staat al in lib/themes.ts en wordt daar (isThemeId)
-- gevalideerd vóór het opslaan; een nieuw theme toevoegen hoeft dan geen migratie.

alter table dataloket.profielen add column if not exists theme text;

comment on column dataloket.profielen.theme is
  'Gekozen vormgeving (theme-id uit lib/themes.ts), of null als er nog niets gekozen is.';
