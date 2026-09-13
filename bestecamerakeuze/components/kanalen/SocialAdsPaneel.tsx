"use client";

import KanaalPagina from "@/components/kanalen/KanaalPagina";
import { ADVERTENTIE_STATISTIEKEN } from "@/lib/windsor/velden";

/**
 * Betaalde social: Meta Ads en LinkedIn Ads.
 *
 * Google staat op een eigen pagina omdat het een ander soort kanaal is — zoekintentie
 * tegenover bereik en beeld — maar in de database delen ze één tabel, zodat een
 * budgetvergelijking tussen kanalen mogelijk blijft.
 *
 * Het platformfilter draait op `platform` en niet op de connector: Instagram-advertenties
 * komen uit de Meta Ads-koppeling en zouden onder een connectorfilter dus als Facebook
 * verschijnen.
 */
export default function SocialAdsPaneel({ ingelogd }: { ingelogd: boolean }) {
  return (
    <KanaalPagina
      pagina="social"
      ingelogd={ingelogd}
      statistieken={ADVERTENTIE_STATISTIEKEN}
      standaardStatistiek="uitgaven"
      filterDimensies={[
        { id: "account", label: "Account" },
        { id: "platform", label: "Platform" },
        { id: "campagne", label: "Campagne" },
        { id: "campagne_doel", label: "Doelstelling" },
        { id: "campagne_status", label: "Status" },
        { id: "campagnemanager", label: "Campagnemanager" },
        // Merk en categorie komen uit de koppeltabel. Die pagina beloofde ze al als
        // filter; hier worden ze het ook.
        { id: "merk", label: "Merk" },
        { id: "categorie", label: "Categorie" },
      ]}
      uitsplitsbaar={[
        { id: "platform", label: "Platform" },
        { id: "account", label: "Account" },
        { id: "campagne", label: "Campagne" },
        { id: "campagne_doel", label: "Doelstelling" },
        { id: "merk", label: "Merk" },
      ]}
      tabellen={[
        {
          titel: "Campagnes",
          toelichting: "opgeteld over de gekozen periode",
          bron: "detail",
          groepeerOp: "campagne",
          groepLabel: "Campagne",
        },
        {
          titel: "Advertenties",
          toelichting: "de losse advertenties, met hun creative",
          bron: "detail",
          groepeerOp: "advertentie_id",
          groepLabel: "Advertentie",
          labelVeld: "advertentie",
          toonBeeld: true,
        },
        {
          // Heette eerder "Plaatsing" maar groepeerde op platform, en dat is hetzelfde
          // als het platformfilter erboven. Nu allebei: waar het netwerk stond, en waar
          // in dat netwerk de advertentie te zien was.
          titel: "Platform",
          toelichting: "op welk netwerk de advertenties liepen",
          bron: "detail",
          groepeerOp: "platform",
          groepLabel: "Platform",
        },
        {
          titel: "Plaatsing",
          toelichting: "waar binnen het platform: feed, stories, reels",
          bron: "detail",
          groepeerOp: "plaatsing",
          groepLabel: "Plaatsing",
        },
      ]}
      leeswijzer="Bereik is per dag uniek geteld, dus de som over meerdere dagen telt iemand die de advertentie op twee dagen zag twee keer. Voor een echt uniek periodebereik is een aparte opvraging bij het platform nodig; die zit niet in deze koppeling."
    />
  );
}
