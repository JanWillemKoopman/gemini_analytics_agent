-- Key/value tabel voor instellingen die géén klant- of projectdata zijn — op dit moment
-- alleen het gedeelde standaardwachtwoord voor collega-accounts die via de
-- Instellingen-pagina (/settings) worden aangemaakt.
--
-- Bewust GEEN RLS-policies: RLS staat aan maar er is geen enkele policy, dus elke rol
-- behalve service_role (die RLS altijd omzeilt) krijgt hier niets te zien. De
-- Instellingen-pagina benadert deze tabel dus nooit rechtstreeks vanuit de browser — alleen
-- server-side API-routes met de service-role-sleutel mogen erbij, en die geven het
-- wachtwoord zelf nooit terug aan de client.
create table if not exists mmm.app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id)
);

alter table mmm.app_settings enable row level security;
