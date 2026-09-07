-- Twee nieuwe bronnen voor de chat: 'Data leads' en 'Data orders 2', beide tabbladen
-- van dezelfde spreadsheet als de Campagnes-tab (zie SHEET_ID in lib/sheet.ts).
--
-- Raw tabellen bewaren de sheetwaarden als tekst, precies zoals de sync ze binnenkrijgt
-- (zie lib/sync/bronnen.ts / app/api/sync/route.ts) — geen impliciete cast-verrassingen
-- bij het inlezen. Alle parsing (NL-datums, komma-getallen) gebeurt hier in de views,
-- die ook bepalen welke kolommen de chat wél/niet ziet.
--
-- Geen van beide tabbladen heeft een natuurlijke unieke sleutel (geen lead- of
-- order-ID), dus de primary key is "regelnummer": het rijnummer uit de sheet op het
-- moment van syncen. Dat is geen stabiel ID over syncs heen, maar dat hoeft ook niet —
-- de sync truncate't en vult de tabel elke keer helemaal opnieuw.

-- ---------------------------------------------------------------------------
-- Data leads
-- ---------------------------------------------------------------------------

create table if not exists dataloket.leads_raw (
  regelnummer         bigint primary key,
  kanaal              text,
  kanaalgroep         text,
  ordersoort          text,
  onderwerp           text,
  merk                text,
  model               text,
  sluitreden          text,
  klantsoort          text,
  aangelegd_ruw       text,
  campagne            text,
  lead_type           text,
  order_geworden_ruw  text,
  ingelezen_op        timestamptz not null default now()
);

-- Bewust NIET de campagnevelden die in de sheet per lead herhaald worden (Budget,
-- Uitgaven, Doel leads/orders, Start/Eind, Status, Orders totaal, Order_campagne, Alles,
-- Campagne alle leads): dat zijn campagnecijfers via een lookup op de campagnenaam, geen
-- leadgegevens. Optellen per lead-rij zou het campagnebudget zoveel keer meetellen als
-- er leads voor die campagne zijn. Die cijfers horen bij de Campagnes-tab, niet hier.
create or replace view dataloket.v_leads as
  select
    kanaal,
    kanaalgroep,
    ordersoort,
    onderwerp,
    merk,
    model,
    sluitreden,
    klantsoort,
    case when nullif(trim(aangelegd_ruw), '') is null then null
         else to_timestamp(trim(aangelegd_ruw), 'DD-MM-YYYY HH24:MI')
    end as aangelegd,
    campagne,
    lead_type,
    coalesce(replace(nullif(trim(order_geworden_ruw), ''), ',', '.')::numeric, 0) > 0
      as order_geworden
  from dataloket.leads_raw;

comment on view dataloket.v_leads is
  'Individuele leads (Data leads-tabblad). Beschreven in lib/dictionary/tabellen/leads.ts.';

-- ---------------------------------------------------------------------------
-- Data orders 2
-- ---------------------------------------------------------------------------

create table if not exists dataloket.orders_raw (
  regelnummer   bigint primary key,
  ordersoort    text,
  merk          text,
  model         text,
  aantal_ruw    text,
  aangelegd_ruw text,
  campagne      text,
  ingelezen_op  timestamptz not null default now()
);

create or replace view dataloket.v_orders as
  select
    ordersoort,
    merk,
    model,
    coalesce(nullif(trim(aantal_ruw), '')::int, 1) as aantal,
    case when nullif(trim(aangelegd_ruw), '') is null then null
         else to_date(trim(aangelegd_ruw), 'DD-MM-YYYY')
    end as aangelegd,
    campagne
  from dataloket.orders_raw;

comment on view dataloket.v_orders is
  'Verkochte voertuigen (Data orders 2-tabblad). Beschreven in lib/dictionary/tabellen/orders.ts.';

-- ---------------------------------------------------------------------------
-- Rechten: alleen v_leads en v_orders vrijgeven aan de chat
-- ---------------------------------------------------------------------------
--
-- v_verkopen was een voorbeeldtabel met verzonnen data om het systeem end-to-end te
-- laten werken vóór er echte bronnen gekoppeld waren; nu die er zijn, mag de chat er
-- niet meer bij — vandaar de revoke in plaats van alleen het schrappen uit het
-- datawoordenboek (zie lib/dictionary/index.ts). De tabel en view zelf blijven bestaan
-- als sjabloon.

grant select on dataloket.v_leads to dataloket_lezer;
grant select on dataloket.v_orders to dataloket_lezer;
revoke select on dataloket.v_verkopen from dataloket_lezer;
