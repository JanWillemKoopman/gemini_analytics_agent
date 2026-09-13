"use client";

import KanaalPagina from "@/components/kanalen/KanaalPagina";
import { ACCOUNT_STATISTIEKEN } from "@/lib/windsor/velden";

/**
 * De ontwikkeling van de accounts zelf: volgers, bereik en interactie per dag.
 *
 * Het filter "Herkomst" is er niet voor de sier. Facebook en LinkedIn leveren een echte
 * dagreeks; Instagram levert die niet, dus daar bouwt de nachtelijke sync de historie op
 * uit eigen momentopnames. Dat verschil hoort zichtbaar te zijn: een Instagram-reeks
 * begint op de dag dat wij zijn gaan meten, niet op de dag dat het account bestond.
 */
export default function AccountPaneel({ ingelogd }: { ingelogd: boolean }) {
  return (
    <KanaalPagina
      pagina="account"
      ingelogd={ingelogd}
      statistieken={ACCOUNT_STATISTIEKEN}
      standaardStatistiek="volgers"
      filterDimensies={[
        { id: "bron", label: "Platform" },
        { id: "account", label: "Account" },
        { id: "herkomst", label: "Herkomst" },
      ]}
      uitsplitsbaar={[
        { id: "account", label: "Account" },
        { id: "bron", label: "Platform" },
      ]}
      tabellen={[
        {
          titel: "Accounts",
          toelichting: "de stand en de groei per account",
          bron: "reeks",
          groepeerOp: "account",
          groepLabel: "Account",
        },
        {
          titel: "Per platform",
          toelichting: "Facebook, Instagram en LinkedIn naast elkaar",
          bron: "reeks",
          groepeerOp: "bron",
          groepLabel: "Platform",
        },
      ]}
      leeswijzer="Volgers is een stand en geen optelsom: vier accounts met tienduizend volgers hebben er samen veertigduizend, ook als je naar vier weken kijkt. Groei, bereik en interacties zijn wél dagwaarden die over de periode worden opgeteld. Instagram-reeksen komen uit onze eigen nachtelijke meting — het platform levert geen historie."
    />
  );
}
