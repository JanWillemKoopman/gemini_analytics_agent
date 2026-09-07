-- Drie uitbreidingen die het wekelijkse campagne-overleg ondersteunen:
--
--  1. Besluitenlogboek — aantekeningen krijgen een soort (observatie/hypothese/besluit/
--     actie) en, bij een hypothese of besluit, het cijfer dat erdoor zou moeten
--     veranderen plus de stand van dat cijfer op het moment van vastleggen.
--  2. Prikbord — grafieken uit de chat die het team wil bewaren.
--  3. Vraagbibliotheek — een geaggregeerde view op de querylog: welke vragen stelt het
--     team het vaakst?

-- ---------------------------------------------------------------------------
-- 1. Besluitenlogboek
-- ---------------------------------------------------------------------------

-- Bestaande aantekeningen zijn allemaal observaties: dat is precies wat ze waren
-- voordat er soorten bestonden, dus de default zet ze in één keer goed.
alter table dataloket.campagne_notities
  add column if not exists soort text not null default 'observatie',
  add column if not exists metriek text,
  add column if not exists metriek_waarde numeric,
  add column if not exists afgerond_op timestamptz;

do $$
begin
  alter table dataloket.campagne_notities
    add constraint campagne_notities_soort_check
    check (soort in ('observatie', 'hypothese', 'besluit', 'actie'));
exception
  when duplicate_object then null;
end;
$$;

comment on column dataloket.campagne_notities.soort is
  'observatie | hypothese | besluit | actie. Een besluit zonder cijfer eronder is een mening; daarom vraagt de UI bij hypothese en besluit om een metriek.';
comment on column dataloket.campagne_notities.metriek is
  'Sleutel uit lib/notities.ts (leads, leadsMarketing, orders, uitgaven): welk cijfer moet hierdoor veranderen?';
comment on column dataloket.campagne_notities.metriek_waarde is
  'De stand van die metriek op het moment van vastleggen, overgenomen uit de sheet. Zonder dit nulpunt is achteraf niet te zien of er iets veranderd is.';
comment on column dataloket.campagne_notities.afgerond_op is
  'Alleen voor soort = actie: wanneer hij is afgevinkt. Null = nog open.';

-- ---------------------------------------------------------------------------
-- 2. Prikbord
-- ---------------------------------------------------------------------------

-- Een vastgepinde grafiek bewaart zowel de vraag en de query als de uitkomst op het
-- moment van vastpinnen. De momentopname staat erbij zodat het prikbord ook iets toont
-- wanneer de dataverbinding er even niet is; met "verversen" wordt hij bijgewerkt door
-- dezelfde SQL opnieuw te draaien (door dezelfde read-only rol en dezelfde guard).
create table if not exists dataloket.prikbord (
  id              uuid primary key default gen_random_uuid(),
  titel           text        not null,
  vraag           text,
  sql             text        not null,
  weergave        jsonb       not null,
  kolommen        jsonb       not null default '[]'::jsonb,
  rijen           jsonb       not null default '[]'::jsonb,
  ververst_op     timestamptz not null default now(),
  aangemaakt_door uuid        not null,
  aangemaakt_op   timestamptz not null default now()
);

comment on table dataloket.prikbord is
  'Grafieken uit de chat die het team heeft vastgepind. Gedeeld: het prikbord is het bord van het weekoverleg, niet een persoonlijke favorietenlijst.';

create index if not exists prikbord_tijd_idx on dataloket.prikbord (aangemaakt_op desc);

alter table dataloket.prikbord enable row level security;

drop policy if exists prikbord_lezen on dataloket.prikbord;
create policy prikbord_lezen on dataloket.prikbord
  for select to authenticated using (true);

drop policy if exists prikbord_toevoegen on dataloket.prikbord;
create policy prikbord_toevoegen on dataloket.prikbord
  for insert to authenticated with check (aangemaakt_door = auth.uid());

drop policy if exists prikbord_wijzigen on dataloket.prikbord;
create policy prikbord_wijzigen on dataloket.prikbord
  for update to authenticated using (true) with check (true);

drop policy if exists prikbord_verwijderen on dataloket.prikbord;
create policy prikbord_verwijderen on dataloket.prikbord
  for delete to authenticated using (true);

grant select, insert, update, delete on dataloket.prikbord to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vraagbibliotheek
-- ---------------------------------------------------------------------------

-- De querylog zelf blijft afgeschermd per gebruiker (zie 0001): niemand hoeft te zien
-- wát een collega precies vroeg. Deze view geeft alleen het geaggregeerde beeld terug —
-- de vraag, hoe vaak hij gesteld is en wanneer voor het laatst — zonder gebruiker-id.
-- Views draaien standaard met de rechten van de eigenaar (security definer), dus de
-- rijbeveiliging op query_log beperkt de telling hier niet.
create or replace view dataloket.v_populaire_vragen as
  select
    min(vraag)                as vraag,
    count(*)::integer         as aantal,
    max(aangemaakt_op)        as laatst_gesteld
  from dataloket.query_log
  where gelukt
    and aangemaakt_op > now() - interval '90 days'
    and length(vraag) between 8 and 200
  group by lower(btrim(vraag))
  having count(*) > 0;

comment on view dataloket.v_populaire_vragen is
  'Welke vragen stelt het team het vaakst? Geaggregeerd en zonder gebruiker-id: bedoeld om te leren welke vragen zinvol zijn, niet om collega''s te volgen.';

grant select on dataloket.v_populaire_vragen to authenticated;
