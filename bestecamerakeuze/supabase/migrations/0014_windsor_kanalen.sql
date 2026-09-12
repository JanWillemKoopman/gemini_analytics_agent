-- De data achter het sidebar-kopje "Kanalen": advertenties, organische posts en
-- accountontwikkeling, opgehaald bij Windsor.ai.
--
-- WAAROM EEN KOPIE EN NIET LIVE BEVRAGEN
-- De Windsor-API is te traag voor een dashboard. Gemeten koude responstijden:
-- Google Ads 7 s, Meta Ads op advertentieniveau 45 s, Instagram per post 61 s en
-- Facebook organic per post 131 s. Daar komt bij dat Instagram géén volgershistorie
-- teruggeeft (`followers_count` levert altijd precies één rij met de datum van vandaag,
-- welke periode je ook opvraagt) en dat Meta niet verder dan 37 maanden terugkijkt.
-- Wat we vannacht niet wegschrijven, bestaat over een jaar dus nergens meer. Deze
-- tabellen zijn daarom geen cache maar het archief.
--
-- DRIE KORRELS, DRIE TABELLEN
-- De connectoren leveren data op drie verschillende niveaus, die je niet in één tabel
-- moet persen: advertenties zijn dag-cijfers, organische posts zijn lifetime-cijfers op
-- publicatiedatum, en accountcijfers zijn dag-cijfers per account. Elk krijgt hier zijn
-- eigen tabel met zijn eigen sleutel.

-- ---------------------------------------------------------------------------
-- Advertenties — dag × advertentie × platform
-- ---------------------------------------------------------------------------
--
-- Eén tabel voor Meta, Google én LinkedIn, met `bron` als onderscheid. Het dashboard
-- toont Social ads en Google Ads op aparte pagina's, maar dat is een weergavekeuze: in
-- de database horen ze bij elkaar, anders kun je geen budget tussen kanalen vergelijken
-- en moet elke query drie keer geschreven worden.
--
-- LET OP bij `platform`: Instagram-advertenties komen uit de Meta Ads-connector
-- (`bron = 'meta'`) met platform 'instagram' — niet uit de Instagram-connector, die
-- puur organisch is. Filter dus altijd op `platform`, nooit op `bron`, als het om het
-- kanaal gaat waar de advertentie draaide.
create table if not exists dataloket.windsor_advertenties (
  datum             date not null,
  bron              text not null,           -- meta | google | linkedin
  account_id        text not null,
  account_naam      text,
  platform          text not null,           -- facebook | instagram | threads | google | linkedin | audience_network
  -- De drie sleutelkolommen hieronder zijn `not null default ''` in plaats van
  -- nullable: ze zitten in de primary key, en in Postgres telt elke NULL als uniek —
  -- twee rijen met een lege plaatsing zouden dan allebei worden ingevoegd in plaats van
  -- elkaar te overschrijven, en de upsert van de sync zou stilletjes dubbeltellen.
  plaatsing         text not null default '', -- feed, stories, reels, search, … (leeg bij Google/LinkedIn)
  campagne_id       text not null default '',
  campagne          text not null,
  campagne_doel     text,                    -- objective / campagnetype
  campagne_status   text,
  adgroep_id        text,                    -- adset (Meta) / ad group (Google) / campaign (LinkedIn)
  adgroep           text,
  advertentie_id    text not null default '',
  advertentie       text,
  advertentie_status text,
  thumbnail_url     text,
  preview_url       text,
  bestemming_url    text,

  -- De twee velden waarmee een advertentie terug te vinden is als organische post.
  -- Meta levert `effective_object_story_id` in exact het formaat van post_id in
  -- windsor_posts, en een Instagram-permalink die de permalink uit Instagram Insights
  -- matcht. Alleen gevuld voor bron 'meta'; Google en LinkedIn kennen dit niet.
  meta_post_id      text,
  instagram_permalink text,

  uitgaven          numeric(12, 4) not null default 0,
  vertoningen       bigint         not null default 0,
  bereik            bigint         not null default 0,
  klikken           bigint         not null default 0,
  link_klikken      bigint         not null default 0,
  interacties       bigint         not null default 0,
  videoweergaven    bigint         not null default 0,
  leads             bigint         not null default 0,
  conversies        numeric(12, 4) not null default 0,
  conversiewaarde   numeric(14, 4) not null default 0,

  -- Alle maatwerkconversies van Meta (22 stuks) en Google (62 stuks) in één kolom, op
  -- veldnaam. Bewust géén 84 fysieke kolommen: marketing zet volgende maand een nieuwe
  -- conversie-actie aan in Google Ads, en dan hoort er geen migratie nodig te zijn. Het
  -- dashboard leest welke acties er zijn uit windsor_conversie_acties hieronder.
  conversie_acties  jsonb not null default '{}'::jsonb,

  ingelezen_op      timestamptz not null default now(),

  primary key (datum, bron, account_id, platform, plaatsing, campagne_id, advertentie_id)
);

comment on table dataloket.windsor_advertenties is
  'Betaalde advertentieprestaties per dag, uit Windsor.ai. Meta, Google en LinkedIn in één tabel; het kanaal waar de advertentie draaide staat in platform, niet in bron.';

-- De index die de dashboardqueries dragen: elke pagina filtert eerst op periode, dan op
-- bron en account. Postgres kan daarmee een kwartaal in enkele milliseconden optellen.
create index if not exists windsor_advertenties_periode_idx
  on dataloket.windsor_advertenties (datum desc, bron, account_id);
create index if not exists windsor_advertenties_campagne_idx
  on dataloket.windsor_advertenties (campagne, datum desc);

-- ---------------------------------------------------------------------------
-- Organische posts — één rij per post
-- ---------------------------------------------------------------------------
--
-- De platforms geven per post lifetime-cijfers, gedateerd op publicatiedatum. Een post
-- die vandaag nog bereik oppikt, krijgt bij de volgende sync dus een hogere waarde op
-- dezelfde datum — daarom een upsert op post_id en geen append.
--
-- `vertoningen_organisch` is de kolom waar het om draait. `vertoningen` telt bij
-- Facebook óók de betaalde distributie mee, waardoor een opgehoogde post eruitziet als
-- een organisch succes. Wie "organisch bereik" bedoelt, moet de organische kolom nemen.
create table if not exists dataloket.windsor_posts (
  post_id               text primary key,
  bron                  text not null,       -- facebook | instagram | linkedin
  account_id            text not null,
  account_naam          text,
  gepubliceerd_op       timestamptz,
  datum                 date not null,       -- publicatiedatum, de as van de grafiek
  post_type             text,                -- feed | reels | story | image | video | document | article | poll | text
  tekst                 text,
  permalink             text,
  afbeelding_url        text,

  vertoningen           bigint not null default 0,
  vertoningen_organisch bigint not null default 0,
  vertoningen_betaald   bigint not null default 0,
  bereik                bigint not null default 0,
  interacties           bigint not null default 0,
  likes                 bigint not null default 0,
  reacties              bigint not null default 0,
  opgeslagen            bigint not null default 0,
  gedeeld               bigint not null default 0,
  klikken               bigint not null default 0,
  nieuwe_volgers        bigint not null default 0,
  videoweergaven        bigint not null default 0,
  kijktijd_ms           bigint not null default 0,

  -- Gevuld zodra dezelfde post ook als advertentie is ingezet. Meta levert bij elke
  -- advertentie `effective_object_story_id` in exact het formaat van post_id, en een
  -- instagram_permalink die de permalink uit Instagram Insights matcht. Zo kan het
  -- dashboard per post laten zien wat organisch gebeurde en wat de euro's erbovenop
  -- deden — iets wat geen enkel platform zelf in één scherm toont.
  opgehoogd             boolean not null default false,
  advertentie_uitgaven  numeric(12, 4) not null default 0,

  ingelezen_op          timestamptz not null default now()
);

comment on table dataloket.windsor_posts is
  'Organische posts met hun lifetime-cijfers, gedateerd op publicatiedatum. Gebruik vertoningen_organisch voor "organisch bereik" — vertoningen telt betaalde distributie mee.';

create index if not exists windsor_posts_periode_idx
  on dataloket.windsor_posts (datum desc, bron, account_id);

-- ---------------------------------------------------------------------------
-- Accountontwikkeling — dag × account
-- ---------------------------------------------------------------------------
--
-- Facebook en LinkedIn leveren een echte dagreeks; Instagram niet. Voor Instagram
-- schrijft de sync elke nacht de stand van vandaag weg, en zo ontstaat de historie die
-- de API niet heeft. `volgers_geschat` markeert die rijen: bij Instagram is de reeks
-- opgebouwd uit onze eigen momentopnames, niet uit platformhistorie. Dat verschil hoort
-- in de grafiek zichtbaar te zijn, niet stilletjes weggepoetst.
create table if not exists dataloket.windsor_account_dag (
  datum                date not null,
  bron                 text not null,        -- facebook | instagram | linkedin
  account_id           text not null,
  account_naam         text,

  volgers              bigint,
  volgers_geschat      boolean not null default false,
  volgers_erbij        bigint,
  volgers_eraf         bigint,
  volgers_erbij_betaald bigint,

  vertoningen          bigint not null default 0,
  vertoningen_organisch bigint not null default 0,
  bereik               bigint not null default 0,
  interacties          bigint not null default 0,
  paginaweergaven      bigint not null default 0,
  aantal_posts         bigint not null default 0,

  ingelezen_op         timestamptz not null default now(),

  primary key (datum, bron, account_id)
);

comment on table dataloket.windsor_account_dag is
  'Accountontwikkeling per dag. Facebook en LinkedIn komen uit platformhistorie; de Instagram-reeks bouwen wij zelf op met een nachtelijke momentopname (volgers_geschat = true).';

-- ---------------------------------------------------------------------------
-- Catalogus van conversie-acties
-- ---------------------------------------------------------------------------
--
-- Welke maatwerkconversies bestaan er, en hoe heten ze in mensentaal? De sync ontdekt
-- ze zelf uit de veldcatalogus van Windsor en vult deze tabel aan; `label` en
-- `standaard` zijn daarna met de hand bij te stellen zonder dat de volgende sync dat
-- overschrijft. `standaard` bepaalt of de statistiek meteen in de tabel staat of pas
-- als iemand hem aanzet — alle acties komen mee, maar niet alle 84 tegelijk in beeld.
create table if not exists dataloket.windsor_conversie_acties (
  veld          text primary key,            -- bv. actions_proefrit_aanvraag
  bron          text not null,               -- meta | google
  label         text not null,               -- "Proefrit aanvraag"
  standaard     boolean not null default false,
  laatst_gezien date,
  gewijzigd     boolean not null default false,  -- true = met de hand aangepast, sync laat label/standaard staan
  ontdekt_op    timestamptz not null default now()
);

comment on table dataloket.windsor_conversie_acties is
  'Welke maatwerkconversies Meta en Google aanbieden. De sync vult hem aan; labels die met de hand zijn bijgesteld (gewijzigd = true) blijven staan.';

-- ---------------------------------------------------------------------------
-- Koppeltabel — wie beheert welke campagne
-- ---------------------------------------------------------------------------
--
-- "Campagnemanager" bestaat niet in de Windsor-data; alle 4.393 velden zijn doorzocht
-- en er is geen eigenaarsveld. Daarom leggen we het zelf vast, op campagnenaam, net
-- zoals campagne_notities dat doet. Eén tabel die het dashboard ook als eigen pagina
-- toont, zodat zichtbaar is wat er nog niet gekoppeld is — een koppeling die je niet
-- kunt zien, gaat niemand onderhouden.
--
-- Naast de eigenaar staan hier de handmatige verrijkingen die uit de campagnenaam niet
-- betrouwbaar af te leiden zijn maar wel als filter gewenst zijn.
create table if not exists dataloket.windsor_campagne_eigenaar (
  campagne        text primary key,
  bron            text,                      -- meta | google | linkedin; leeg = geldt overal
  eigenaar_id     uuid references auth.users (id) on delete set null,
  eigenaar_naam   text,                      -- vrije naam voor wie geen account heeft
  merk            text,
  categorie       text,                      -- Acties | After Sales | Sales | Vacatures | Verhuur | Branding
  sheet_campagne  text,                      -- naam in de campagnesheet, voor de koppeling met budget/doelen
  notitie         text,
  aangemaakt_door uuid,
  aangemaakt_op   timestamptz not null default now(),
  bijgewerkt_door uuid,
  bijgewerkt_op   timestamptz not null default now()
);

comment on table dataloket.windsor_campagne_eigenaar is
  'Koppeltabel: campagnenaam → campagnemanager, merk, categorie en de bijbehorende campagne in de sheet. Handmatig beheerd via de pagina Koppeltabel.';

alter table dataloket.windsor_campagne_eigenaar enable row level security;

-- Zelfde afweging als bij campagne_notities: dit is gedeelde kennis over campagnes,
-- geen persoonlijke aantekening. Iedereen die is ingelogd mag lezen en bijwerken; wie
-- wat deed blijft zichtbaar via bijgewerkt_door.
drop policy if exists windsor_eigenaar_lezen on dataloket.windsor_campagne_eigenaar;
create policy windsor_eigenaar_lezen on dataloket.windsor_campagne_eigenaar
  for select to authenticated using (true);

drop policy if exists windsor_eigenaar_toevoegen on dataloket.windsor_campagne_eigenaar;
create policy windsor_eigenaar_toevoegen on dataloket.windsor_campagne_eigenaar
  for insert to authenticated with check (aangemaakt_door = auth.uid());

drop policy if exists windsor_eigenaar_wijzigen on dataloket.windsor_campagne_eigenaar;
create policy windsor_eigenaar_wijzigen on dataloket.windsor_campagne_eigenaar
  for update to authenticated using (true) with check (true);

drop policy if exists windsor_eigenaar_verwijderen on dataloket.windsor_campagne_eigenaar;
create policy windsor_eigenaar_verwijderen on dataloket.windsor_campagne_eigenaar
  for delete to authenticated using (true);

grant select, insert, update, delete on dataloket.windsor_campagne_eigenaar to authenticated;

create or replace function dataloket.stempel_windsor_eigenaar()
returns trigger
language plpgsql
security definer
set search_path = dataloket
as $$
begin
  new.bijgewerkt_op := now();
  return new;
end;
$$;

drop trigger if exists windsor_eigenaar_stempel on dataloket.windsor_campagne_eigenaar;
create trigger windsor_eigenaar_stempel
  before update on dataloket.windsor_campagne_eigenaar
  for each row execute function dataloket.stempel_windsor_eigenaar();

-- ---------------------------------------------------------------------------
-- Views voor de chat en het dashboard
-- ---------------------------------------------------------------------------
--
-- De v_-views zijn wat de chatbot mag zien (zie lib/dataQuery.ts en de rol
-- dataloket_lezer). Ze laten de ruwe jsonb-kolom en de interne id's weg en voegen de
-- koppeltabel toe, zodat een vraag als "wat gaf Sanne deze maand uit aan Porsche?"
-- beantwoordbaar is zonder de join zelf te schrijven.
create or replace view dataloket.v_advertenties as
select
  a.datum,
  a.bron,
  a.account_naam            as account,
  a.platform,
  a.plaatsing,
  a.campagne,
  a.campagne_doel,
  a.campagne_status,
  a.adgroep,
  a.advertentie,
  a.advertentie_status,
  coalesce(k.eigenaar_naam, '—')  as campagnemanager,
  k.merk,
  k.categorie,
  a.uitgaven,
  a.vertoningen,
  a.bereik,
  a.klikken,
  a.link_klikken,
  a.interacties,
  a.videoweergaven,
  a.leads,
  a.conversies,
  a.conversiewaarde
from dataloket.windsor_advertenties a
left join dataloket.windsor_campagne_eigenaar k on k.campagne = a.campagne;

comment on view dataloket.v_advertenties is
  'Betaalde advertentieprestaties per dag, verrijkt met de koppeltabel. Platform zegt waar de advertentie draaide; bron zegt uit welk advertentieplatform hij kwam.';

create or replace view dataloket.v_posts as
select
  p.datum,
  p.bron,
  p.account_naam as account,
  p.post_type,
  p.tekst,
  p.permalink,
  p.vertoningen_organisch,
  p.vertoningen_betaald,
  p.bereik,
  p.interacties,
  p.likes,
  p.reacties,
  p.opgeslagen,
  p.gedeeld,
  p.klikken,
  p.nieuwe_volgers,
  p.videoweergaven,
  p.opgehoogd,
  p.advertentie_uitgaven
from dataloket.windsor_posts p;

comment on view dataloket.v_posts is
  'Organische posts met lifetime-cijfers. vertoningen_organisch is het echte organische bereik; opgehoogd zegt of er ook advertentiegeld op stond.';

create or replace view dataloket.v_account_ontwikkeling as
select
  datum,
  bron,
  account_naam as account,
  volgers,
  volgers_geschat,
  volgers_erbij,
  volgers_eraf,
  coalesce(volgers_erbij, 0) - coalesce(volgers_eraf, 0) as volgers_netto,
  vertoningen,
  vertoningen_organisch,
  bereik,
  interacties,
  paginaweergaven,
  aantal_posts
from dataloket.windsor_account_dag;

comment on view dataloket.v_account_ontwikkeling is
  'Accountontwikkeling per dag. volgers_geschat = true betekent dat de reeks uit onze eigen nachtelijke momentopnames komt (Instagram) in plaats van uit platformhistorie.';

grant select on dataloket.v_advertenties to dataloket_lezer;
grant select on dataloket.v_posts to dataloket_lezer;
grant select on dataloket.v_account_ontwikkeling to dataloket_lezer;
