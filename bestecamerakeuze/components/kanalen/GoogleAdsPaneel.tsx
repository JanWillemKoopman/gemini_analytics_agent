"use client";

import KanaalPagina from "@/components/kanalen/KanaalPagina";
import { ADVERTENTIE_STATISTIEKEN } from "@/lib/windsor/velden";

/**
 * Google Ads: Search, Performance Max, Demand Gen en Display.
 *
 * Twee verschillen met de socialpagina die in de data zitten en niet weggepoetst worden:
 * Google levert geen bereik op advertentieniveau, en leads zitten hier niet in een apart
 * veld maar in de conversie-acties. Beide kolommen staan daarom **niet** in de lijst
 * hieronder. Ze stonden er eerder wel, en dan keek je op de pagina waar leads het
 * belangrijkste getal zijn naar een kolom met louter nullen en een kosten-per-lead met
 * louter streepjes — een leeg vakje leest als "nul leads" en niet als "dit meten we hier
 * niet". Conversies is voor Google het cijfer dat de leads bevat.
 */
/**
 * Statistieken die de Google-koppeling niet vult. Ze weglaten is eerlijker dan ze op nul
 * tonen: `bereik` levert Google niet op advertentieniveau, `leads` schrijft de sync hard
 * op nul (het zit in de conversie-acties), en `frequentie` en `kosten per lead` zijn
 * afgeleiden van die twee.
 */
const GOOGLE_ONBESCHIKBAAR = new Set(["bereik", "frequentie", "leads", "cpl"]);

export default function GoogleAdsPaneel({ ingelogd }: { ingelogd: boolean }) {
  return (
    <KanaalPagina
      pagina="google"
      ingelogd={ingelogd}
      statistieken={ADVERTENTIE_STATISTIEKEN.filter(
        (s) => !GOOGLE_ONBESCHIKBAAR.has(s.id),
      )}
      standaardStatistiek="uitgaven"
      filterDimensies={[
        { id: "account", label: "Account" },
        { id: "campagne", label: "Campagne" },
        { id: "campagne_doel", label: "Campagnetype" },
        { id: "campagne_status", label: "Status" },
        { id: "campagnemanager", label: "Campagnemanager" },
        { id: "merk", label: "Merk" },
        { id: "categorie", label: "Categorie" },
      ]}
      uitsplitsbaar={[
        { id: "campagne_doel", label: "Campagnetype" },
        { id: "campagne", label: "Campagne" },
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
      leeswijzer="Google rapporteert geen bereik per advertentie en levert leads niet als apart veld, dus die twee kolommen ontbreken hier bewust in plaats van als nul te verschijnen. Conversies zijn de acties die in Google Ads als conversie zijn ingesteld, inclusief de GA4-doelen — de leadformulieren zitten daar dus in."
    />
  );
}
