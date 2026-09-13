"use client";

import KanaalPagina from "@/components/kanalen/KanaalPagina";
import { ADVERTENTIE_STATISTIEKEN } from "@/lib/windsor/velden";

/**
 * Google Ads: Search, Performance Max, Demand Gen en Display.
 *
 * Twee verschillen met de socialpagina die in de data zitten en niet weggepoetst worden:
 * Google levert geen bereik op advertentieniveau (die kolom blijft dus nul), en leads
 * zitten hier niet in een apart veld maar in de conversie-acties.
 */
export default function GoogleAdsPaneel({ ingelogd }: { ingelogd: boolean }) {
  return (
    <KanaalPagina
      pagina="google"
      ingelogd={ingelogd}
      statistieken={ADVERTENTIE_STATISTIEKEN.filter((s) => s.id !== "bereik" && s.id !== "frequentie")}
      standaardStatistiek="uitgaven"
      filterDimensies={[
        { id: "account", label: "Account" },
        { id: "campagne", label: "Campagne" },
        { id: "campagne_doel", label: "Campagnetype" },
        { id: "campagne_status", label: "Status" },
        { id: "campagnemanager", label: "Campagnemanager" },
      ]}
      uitsplitsbaar={[
        { id: "campagne_doel", label: "Campagnetype" },
        { id: "campagne", label: "Campagne" },
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
          titel: "Advertentiegroepen",
          toelichting: "de indeling binnen de campagnes",
          bron: "detail",
          groepeerOp: "adgroep",
          groepLabel: "Advertentiegroep",
        },
        {
          titel: "Campagnetypes",
          toelichting: "Search, Pmax, Demand Gen en Display naast elkaar",
          bron: "detail",
          groepeerOp: "campagne_doel",
          groepLabel: "Campagnetype",
        },
      ]}
      leeswijzer="Google rapporteert geen bereik per advertentie, dus die kolom ontbreekt hier bewust in plaats van als nul te verschijnen. Conversies zijn de acties die in Google Ads als conversie zijn ingesteld, inclusief de GA4-doelen."
    />
  );
}
