-- Tabblad "Kennis en acties": alle aantekeningen over alle campagnes heen, met een
-- puntentelling per collega erboven.
--
-- Er komt hier geen nieuwe tabel bij. Het overzicht leest exact dezelfde rijen als het
-- besluitenlogboek in de campagnekolom (dataloket.campagne_notities, zie 0005 en 0007);
-- een tweede opslag naast die tabel zou alleen maar twee waarheden opleveren.
--
-- Twee dingen die wél nodig zijn:
--
--  1. Een index op de tijd. Het overzicht haalt de nieuwste N aantekeningen op zonder
--     campagnefilter; de bestaande index (campagne_naam, aangemaakt_op) helpt daar niet
--     bij, want die begint bij de campagnenaam.
--  2. Vastleggen dat een campagnenaam die niet in de sheet voorkomt geen fout is. Iemand
--     kan een inzicht vastleggen dat niet aan één campagne hangt ("vrij onderwerp"); dat
--     verschijnt alleen in dit overzicht en nergens bij de campagnes, simpelweg omdat er
--     geen campagne met die naam bestaat om het aan te tonen. Daar is geen extra kolom of
--     vlag voor nodig — de koppeling op naam regelt het vanzelf.

create index if not exists campagne_notities_tijd_idx
  on dataloket.campagne_notities (aangemaakt_op desc);

comment on column dataloket.campagne_notities.campagne_naam is
  'De campagnenaam uit de Google Sheet, of een vrij gekozen onderwerp. Een naam die niet in de sheet voorkomt, hoort bij een los inzicht: die aantekening is alleen zichtbaar op het tabblad "Kennis en acties" en maakt geen campagne aan.';
