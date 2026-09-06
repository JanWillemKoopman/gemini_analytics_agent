-- Google Ads: vier ruwe tabellen + views voor campagnes, zoekwoorden, advertentiegroepen
-- en conversies. Gevuld door /api/sync-ads (zie lib/sync/googleAds.ts), niet door de
-- sheet-sync in lib/sync/bronnen.ts.
--
-- Geen natuurlijke sleutel per rij (in tegenstelling tot verkopen_raw): elke sync
-- vervangt de hele tabel, dus een bigserial-id is genoeg.

-- ---------------------------------------------------------------------------
-- Campagnes
-- ---------------------------------------------------------------------------

create table if not exists dataloket.ads_campagnes_raw (
  id                bigserial primary key,
  klant_id          text        not null,
  klant_naam        text        not null,
  campagne_id       text        not null,
  campagne_naam     text        not null,
  status            text,
  datum             date        not null,
  kosten            numeric(12, 2),
  kliks             integer,
  vertoningen       integer,
  conversies        numeric(12, 2),
  conversiewaarde   numeric(12, 2),
  ingelezen_op      timestamptz not null default now()
);

create or replace view dataloket.v_ads_campagnes as
  select
    klant_naam,
    campagne_naam,
    status,
    datum,
    kosten,
    kliks,
    vertoningen,
    conversies,
    conversiewaarde,
    case when vertoningen > 0 then round(kliks::numeric / vertoningen, 4) end as ctr,
    case when kliks > 0 then round(kosten / kliks, 2) end as cpc
  from dataloket.ads_campagnes_raw;

comment on view dataloket.v_ads_campagnes is
  'Google Ads campagneprestaties per dag. Beschreven in lib/dictionary/tabellen/googleAdsCampagnes.ts.';

-- ---------------------------------------------------------------------------
-- Zoekwoorden
-- ---------------------------------------------------------------------------

create table if not exists dataloket.ads_zoekwoorden_raw (
  id                      bigserial primary key,
  klant_id                text        not null,
  klant_naam              text        not null,
  campagne_naam           text        not null,
  advertentiegroep_naam   text        not null,
  zoekwoord_tekst         text        not null,
  zoekwoord_matchtype     text,
  kwaliteitsscore         integer,
  datum                   date        not null,
  kosten                  numeric(12, 2),
  kliks                   integer,
  vertoningen             integer,
  ingelezen_op            timestamptz not null default now()
);

create or replace view dataloket.v_ads_zoekwoorden as
  select
    klant_naam,
    campagne_naam,
    advertentiegroep_naam,
    zoekwoord_tekst,
    zoekwoord_matchtype,
    kwaliteitsscore,
    datum,
    kosten,
    kliks,
    vertoningen,
    case when vertoningen > 0 then round(kliks::numeric / vertoningen, 4) end as ctr
  from dataloket.ads_zoekwoorden_raw;

comment on view dataloket.v_ads_zoekwoorden is
  'Google Ads zoekwoordprestaties per dag. Beschreven in lib/dictionary/tabellen/googleAdsZoekwoorden.ts.';

-- ---------------------------------------------------------------------------
-- Advertentiegroepen
-- ---------------------------------------------------------------------------

create table if not exists dataloket.ads_advertentiegroepen_raw (
  id                      bigserial primary key,
  klant_id                text        not null,
  klant_naam              text        not null,
  campagne_naam           text        not null,
  advertentiegroep_naam   text        not null,
  status                  text,
  datum                   date        not null,
  kosten                  numeric(12, 2),
  kliks                   integer,
  vertoningen             integer,
  conversies              numeric(12, 2),
  conversiewaarde         numeric(12, 2),
  ingelezen_op            timestamptz not null default now()
);

create or replace view dataloket.v_ads_advertentiegroepen as
  select
    klant_naam,
    campagne_naam,
    advertentiegroep_naam,
    status,
    datum,
    kosten,
    kliks,
    vertoningen,
    conversies,
    conversiewaarde
  from dataloket.ads_advertentiegroepen_raw;

comment on view dataloket.v_ads_advertentiegroepen is
  'Google Ads prestaties per advertentiegroep per dag. Beschreven in lib/dictionary/tabellen/googleAdsAdvertentiegroepen.ts.';

-- ---------------------------------------------------------------------------
-- Conversies
-- ---------------------------------------------------------------------------

create table if not exists dataloket.ads_conversies_raw (
  id                    bigserial primary key,
  klant_id              text        not null,
  klant_naam            text        not null,
  campagne_naam         text        not null,
  conversieactie_naam   text        not null,
  conversiecategorie    text,
  datum                 date        not null,
  aantal_conversies     numeric(12, 2),
  conversiewaarde       numeric(12, 2),
  ingelezen_op          timestamptz not null default now()
);

create or replace view dataloket.v_ads_conversies as
  select
    klant_naam,
    campagne_naam,
    conversieactie_naam,
    conversiecategorie,
    datum,
    aantal_conversies,
    conversiewaarde
  from dataloket.ads_conversies_raw;

comment on view dataloket.v_ads_conversies is
  'Google Ads conversies per conversieactie per dag. Beschreven in lib/dictionary/tabellen/googleAdsConversies.ts.';

-- ---------------------------------------------------------------------------
-- Vrijgeven aan de read-only rol
-- ---------------------------------------------------------------------------
-- Bewust geen automatisme (zie 0001_dataloket.sql): een view die niemand heeft
-- vrijgegeven, bestaat niet voor de chat.

grant select on dataloket.v_ads_campagnes to dataloket_lezer;
grant select on dataloket.v_ads_zoekwoorden to dataloket_lezer;
grant select on dataloket.v_ads_advertentiegroepen to dataloket_lezer;
grant select on dataloket.v_ads_conversies to dataloket_lezer;
