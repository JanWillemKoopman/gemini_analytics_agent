-- Key/value tabel voor app-brede instellingen die geen campagnedata zijn — op dit
-- moment alleen het gedeelde standaardwachtwoord voor collega-accounts die via
-- Instellingen → Gebruikers worden aangemaakt.
--
-- Bewust GEEN policies: RLS staat aan, maar zonder policy krijgt elke rol behalve
-- service_role (die RLS altijd omzeilt) hier niets te zien. Instellingen → Gebruikers
-- benadert deze tabel dus nooit rechtstreeks vanuit de browser — alleen de
-- /api/gebruikers/*-routes met de service-role-sleutel mogen erbij, en die geven het
-- wachtwoord zelf nooit terug aan de client.
create table if not exists dataloket.instellingen (
  sleutel       text primary key,
  waarde        text not null,
  bijgewerkt_op timestamptz not null default now(),
  bijgewerkt_door uuid references auth.users (id)
);

alter table dataloket.instellingen enable row level security;
