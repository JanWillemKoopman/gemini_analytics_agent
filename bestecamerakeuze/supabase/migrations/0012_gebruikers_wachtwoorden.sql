-- Wachtwoord per collega-account in leesbare vorm, zodat de twee beheeraccounts
-- (koopman.janwillem@gmail.com en jkoopman@udenhout.nl) het bij Instellingen →
-- Gebruikers kunnen tonen en wijzigen — bv. om een collega telefonisch het wachtwoord
-- door te geven. Dit is een bewuste afwijking van de gebruikelijke "alleen een hash
-- bewaren"-regel: voor dit interne, kleinschalige collega-dashboard weegt het gemak van
-- een zichtbaar wachtwoord op tegen het risico, zolang de tabel maar nooit via de
-- normale (RLS-beperkte) client-rol leesbaar of schrijfbaar is.
--
-- Geen RLS-policies en geen grants aan `authenticated`/`anon`: met RLS aan en zonder
-- policy is de tabel voor die rollen ontoegankelijk. Alleen de service-role-client
-- (lib/supabase/admin.ts, gebruikt in app/api/gebruikers/*) omzeilt RLS en kan lezen/
-- schrijven — de admin-check (isBeheerder) zit in die routes, niet in de database.

create table if not exists dataloket.gebruikers_wachtwoorden (
  id            uuid primary key references auth.users (id) on delete cascade,
  wachtwoord    text not null,
  bijgewerkt_op timestamptz not null default now()
);

comment on table dataloket.gebruikers_wachtwoorden is
  'Laatst bekende wachtwoord per account, in leesbare vorm. Alleen bereikbaar via de service-role-client vanuit app/api/gebruikers/* — geen RLS-policies, dus voor authenticated/anon volledig ontoegankelijk.';

alter table dataloket.gebruikers_wachtwoorden enable row level security;

create or replace function dataloket.stempel_gebruikers_wachtwoord()
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

drop trigger if exists gebruikers_wachtwoord_stempel on dataloket.gebruikers_wachtwoorden;
create trigger gebruikers_wachtwoord_stempel
  before update on dataloket.gebruikers_wachtwoorden
  for each row execute function dataloket.stempel_gebruikers_wachtwoord();
