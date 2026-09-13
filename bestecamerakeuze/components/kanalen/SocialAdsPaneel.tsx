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
      ]}
      uitsplitsbaar={[
        { id: "platform", label: "Platform" },
        { id: "account", label: "Account" },
        { id: "campagne", label: "Campagne" },
        { id: "campagne_doel", label: "Doelstelling" },
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
          groepeerOp: "advertentie",
          groepLabel: "Advertentie",
          toonBeeld: true,
        },
        {
          titel: "Plaatsing",
          toelichting: "waar de advertenties werden getoond",
          bron: "detail",
          groepeerOp: "platform",
          groepLabel: "Platform",
        },
      ]}
      leeswijzer="Bereik is per dag uniek geteld, dus de som over meerdere dagen telt iemand die de advertentie op twee dagen zag twee keer. Voor een echt uniek periodebereik is een aparte opvraging bij het platform nodig; die zit niet in deze koppeling."
    />
  );
}
