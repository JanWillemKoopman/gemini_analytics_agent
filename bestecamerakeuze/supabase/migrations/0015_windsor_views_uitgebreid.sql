-- De v_-views uit 0014 waren geschreven voor de chatbot: alleen leesbare namen, geen
-- id's en geen URL's. Het dashboard leest dezelfde views (via DATAQUERY_DATABASE_URL en
-- de rol dataloket_lezer) en heeft er drie dingen bij nodig:
--
--  - de id's, om een advertentie of campagne stabiel te kunnen identificeren als twee
--    campagnes dezelfde naam dragen;
--  - de creative, zodat de advertentietabel de advertentie kan tónen in plaats van
--    alleen zijn naam — voor een marketeer is dat beeld vaak het snelste herkenpunt;
--  - de koppelvelden naar de organische post, voor de kolom "waarvan betaald".
--
-- Bewust één set views voor beide gebruikers in plaats van een tweede set voor het
-- dashboard: twee definities van hetzelfde cijfer lopen vroeg of laat uit elkaar, en dan
-- geeft de chat een ander antwoord dan de tabel ernaast.

-- Let op: `create or replace view` kan alleen kolommen áchteraan toevoegen, niet
-- invoegen of hernoemen. Deze views krijgen er kolommen middenin bij, dus ze moeten
-- eerst vallen. Dat kan hier zonder risico: er hangt niets aan deze views behalve de
-- leesrechten, die onderaan opnieuw worden gezet.
drop view if exists dataloket.v_advertenties;
drop view if exists dataloket.v_posts;
drop view if exists dataloket.v_account_ontwikkeling;

create or replace view dataloket.v_advertenties as
select
  a.datum,
  a.bron,
  a.account_id,
  a.account_naam            as account,
  a.platform,
  a.plaatsing,
  a.campagne_id,
  a.campagne,
  a.campagne_doel,
  a.campagne_status,
  a.adgroep,
  a.advertentie_id,
  a.advertentie,
  a.advertentie_status,
  a.thumbnail_url,
  a.preview_url,
  a.bestemming_url,
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
  a.conversiewaarde,
  a.conversie_acties
from dataloket.windsor_advertenties a
left join dataloket.windsor_campagne_eigenaar k on k.campagne = a.campagne;

comment on view dataloket.v_advertenties is
  'Betaalde advertentieprestaties per dag, verrijkt met de koppeltabel. Platform zegt waar de advertentie draaide; bron zegt uit welk advertentieplatform hij kwam.';

create or replace view dataloket.v_posts as
select
  p.post_id,
  p.datum,
  p.bron,
  p.account_id,
  p.account_naam as account,
  p.post_type,
  p.tekst,
  p.permalink,
  p.afbeelding_url,
  p.vertoningen,
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
  p.kijktijd_ms,
  p.opgehoogd,
  p.advertentie_uitgaven
from dataloket.windsor_posts p;

comment on view dataloket.v_posts is
  'Organische posts met lifetime-cijfers. vertoningen_organisch is het echte organische bereik; opgehoogd zegt of er ook advertentiegeld op stond.';

create or replace view dataloket.v_account_ontwikkeling as
select
  datum,
  bron,
  account_id,
  account_naam as account,
  volgers,
  volgers_geschat,
  volgers_erbij,
  volgers_eraf,
  volgers_erbij_betaald,
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

-- create or replace laat bestaande grants staan, maar bij een view die van kolommen
-- verandert is dat makkelijk mis te lezen — daarom expliciet opnieuw.
grant select on dataloket.v_advertenties to dataloket_lezer;
grant select on dataloket.v_posts to dataloket_lezer;
grant select on dataloket.v_account_ontwikkeling to dataloket_lezer;

-- De paginakop toont wanneer de laatste Windsor-sync klaar was. Dat leest dezelfde
-- read-only rol, dus die heeft leesrecht op het runlogboek nodig — schrijven doet
-- alleen de sync zelf, met een andere verbinding.
grant select on dataloket.sync_runs to dataloket_lezer;
