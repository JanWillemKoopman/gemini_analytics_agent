"use client";

import KanaalPagina from "@/components/kanalen/KanaalPagina";
import { POST_STATISTIEKEN } from "@/lib/windsor/velden";

/**
 * Onbetaalde posts op Facebook, Instagram en LinkedIn.
 *
 * De standaardstatistiek is bewust `vertoningen_organisch` en niet `vertoningen`: dat
 * laatste veld telt bij Facebook de betaalde distributie mee, waardoor een opgehoogde
 * post eruitziet als een organisch succes. Het filter "Inzet" scheidt de posts waar
 * advertentiegeld op stond van de rest.
 */
export default function OrganischPaneel({ ingelogd }: { ingelogd: boolean }) {
  return (
    <KanaalPagina
      pagina="organisch"
      ingelogd={ingelogd}
      statistieken={POST_STATISTIEKEN}
      standaardStatistiek="vertoningen_organisch"
      filterDimensies={[
        { id: "bron", label: "Platform" },
        { id: "account", label: "Account" },
        { id: "post_type", label: "Type post" },
        { id: "inzet", label: "Inzet" },
      ]}
      uitsplitsbaar={[
        { id: "bron", label: "Platform" },
        { id: "account", label: "Account" },
        { id: "post_type", label: "Type post" },
      ]}
      tabellen={[
        {
          titel: "Posts",
          toelichting: "elke post met zijn lifetime-cijfers, nieuwste bovenaan te sorteren",
          bron: "detail",
          groepeerOp: "tekst",
          groepLabel: "Post",
          toonBeeld: true,
        },
        {
          titel: "Per account",
          toelichting: "opgeteld over alle posts in de periode",
          bron: "reeks",
          groepeerOp: "account",
          groepLabel: "Account",
        },
        {
          titel: "Per type post",
          toelichting: "feed, reel, story, carrousel — wat werkt waar",
          bron: "reeks",
          groepeerOp: "post_type",
          groepLabel: "Type post",
        },
      ]}
      leeswijzer="Een post draagt zijn lifetime-cijfers op zijn publicatiedatum: een post van vorige maand die nu nog bereik oppikt, telt mee op de dag dat hij geplaatst is. Zo blijft 'wat leverde die post op' bij elkaar staan in plaats van uitgesmeerd over de weken erna."
    />
  );
}
