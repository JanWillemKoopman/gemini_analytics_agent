-- Bugfix: de service-role-client (lib/supabase/admin.ts, gebruikt in app/api/gebruikers/*)
-- kreeg tot nu toe "permission denied for schema dataloket" zodra hij dataloket-tabellen
-- aansprak. `create schema dataloket` (0001_dataloket.sql) geeft van zichzelf geen
-- rechten aan andere rollen dan de eigenaar — elke migratie sindsdien deed wel
-- `grant usage on schema dataloket to authenticated`, maar nooit aan `service_role`.
-- Dat bleef onopgemerkt omdat de enige plek die er tot dusver op leunde
-- (huidigStandaardWachtwoord in app/api/gebruikers/route.ts) de foutmelding negeerde en
-- stilzwijgend terugviel op het standaardwachtwoord. `service_role` omzeilt RLS, maar
-- niet gewone schema-/tabelrechten — die moeten hier alsnog expliciet.

grant usage on schema dataloket to service_role;

-- dataloket.instellingen: gelezen/geschreven door /api/gebruikers (standaardwachtwoord)
-- en /api/gebruikers/wachtwoord.
grant select, insert, update on dataloket.instellingen to service_role;

-- dataloket.profielen: gelezen/geschreven namens een collega door een beheerder
-- (haalAlleProfielen, wijzigProfielAlsBeheerder — zie lib/profielen.ts).
grant select, insert, update on dataloket.profielen to service_role;

-- dataloket.gebruikers_wachtwoorden: uitsluitend via de service-role-client bereikbaar
-- (0012_gebruikers_wachtwoorden.sql liet grants aan authenticated/anon bewust weg, maar
-- vergat ook service_role zelf niet expliciet toe te voegen).
grant select, insert, update on dataloket.gebruikers_wachtwoorden to service_role;
