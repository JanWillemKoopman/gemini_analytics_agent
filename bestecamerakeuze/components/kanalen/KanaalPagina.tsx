"use client";

import { useMemo, useState } from "react";
import KanalenFilterBalk, { type FilterDimensie } from "@/components/kanalen/KanalenFilterBalk";
import StatistiekTabel from "@/components/kanalen/StatistiekTabel";
import TijdGrafiek from "@/components/kanalen/TijdGrafiek";
import Inlogprompt from "@/components/Inlogprompt";
import { PERIODES, useKanaalData, useSelectie, type PaginaSleutel } from "@/lib/kanalen/gebruik";
import { filter } from "@/lib/kanalen/kubus";
import type { Statistiek } from "@/lib/windsor/velden";

/**
 * De gedeelde opbouw van een Kanalen-pagina: filterbalk bovenaan, grafiek eronder,
 * tabellen daaronder.
 *
 * Eén component voor alle vier de datapagina's in plaats van vier vrijwel gelijke
 * bestanden. Wat per pagina verschilt staat in de props: welke statistieken er zijn,
 * waarop je kunt filteren, en welke tabellen eronder horen. Wat hetzelfde is — de
 * volgorde, de plakkende balk, het instant filteren — staat één keer hier.
 */

export interface TabelConfig {
  titel: string;
  toelichting: string;
  /** Uit welke kubus: `reeks` heeft de tijdas, `detail` de fijnste korrel. */
  bron: "reeks" | "detail";
  groepeerOp: string;
  groepLabel: string;
  toonBeeld?: boolean;
}

type Props = {
  pagina: PaginaSleutel;
  ingelogd: boolean;
  statistieken: Statistiek[];
  standaardStatistiek: string;
  filterDimensies: FilterDimensie[];
  uitsplitsbaar: { id: string; label: string }[];
  tabellen: TabelConfig[];
  /** Eén regel context onder de grafiek, als er iets is dat je moet weten om het goed te lezen. */
  leeswijzer?: string;
};

export default function KanaalPagina({
  pagina,
  ingelogd,
  statistieken,
  standaardStatistiek,
  filterDimensies,
  uitsplitsbaar,
  tabellen,
  leeswijzer,
}: Props) {
  const [periode, setPeriode] = useState(PERIODES[1]);
  const [uitlegAan, setUitlegAan] = useState(false);
  const data = useKanaalData(pagina, periode.dagen);
  const dimensieIds = useMemo(() => filterDimensies.map((d) => d.id), [filterDimensies]);
  const { selectie, zet, wis, aantalActief } = useSelectie(dimensieIds);

  // Hier gebeurt het filteren: twee passes over een paar duizend rijen, zonder netwerk.
  // Alles wat de gebruiker aanklikt behalve de periode komt hier langs.
  const reeksRijen = useMemo(() => filter(data.reeks, selectie), [data.reeks, selectie]);
  const detailRijen = useMemo(() => filter(data.detail, selectie), [data.detail, selectie]);

  const gefilterdeReeks = useMemo(
    () => ({ ...data.reeks, rijen: reeksRijen }),
    [data.reeks, reeksRijen],
  );

  if (!ingelogd) {
    return <Inlogprompt tekst="Log in om de kanaalcijfers te bekijken." />;
  }

  return (
    <div>
      <KanalenFilterBalk
        kubus={data.reeks}
        selectie={selectie}
        dimensies={filterDimensies}
        periode={periode}
        onPeriode={setPeriode}
        onFilter={zet}
        onWis={wis}
        aantalActief={aantalActief}
        aantalRijen={reeksRijen.length}
        aantalTotaal={data.reeks.rijen.length}
        uitlegAan={uitlegAan}
        onUitleg={() => setUitlegAan((v) => !v)}
        bezig={data.bezig}
        onHerlaad={data.herlaad}
      />

      {data.fout && (
        <p className="mb-5 rounded-panel border border-line bg-card px-4 py-3 text-sm text-negative">
          {data.fout}
        </p>
      )}

      {!data.fout && !data.bezig && data.reeks.rijen.length === 0 && (
        <LegeStaat laatsteSync={data.laatsteSync} />
      )}

      {data.reeks.rijen.length > 0 && (
        <div className="flex flex-col gap-5">
          <TijdGrafiek
            kubus={gefilterdeReeks}
            statistieken={statistieken}
            uitsplitsbaar={uitsplitsbaar}
            standaardStatistiek={standaardStatistiek}
          />

          {uitlegAan && leeswijzer && (
            <p className="rounded-panel border border-line bg-surface-tint px-4 py-3 text-meta text-ink-muted">
              {leeswijzer}
            </p>
          )}

          {tabellen.map((tabel) => (
            <StatistiekTabel
              key={tabel.titel}
              titel={tabel.titel}
              toelichting={tabel.toelichting}
              kubus={tabel.bron === "reeks" ? data.reeks : data.detail}
              rijen={tabel.bron === "reeks" ? reeksRijen : detailRijen}
              groepeerOp={tabel.groepeerOp}
              groepLabel={tabel.groepLabel}
              statistieken={statistieken}
              toonBeeld={tabel.toonBeeld}
              uitlegAan={uitlegAan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Wat er staat zolang de sync nog niet gedraaid heeft.
 *
 * Bewust geen lege tabel met streepjes: die suggereert dat er niets ís, terwijl er nog
 * niets is opgehaald. Het verschil tussen "geen resultaten" en "nog geen data" is voor
 * wie op een cijfer wacht het hele verschil.
 */
function LegeStaat({ laatsteSync }: { laatsteSync: string | null }) {
  return (
    <div className="kaart-omlijst rounded-panel border border-line bg-card px-6 py-12 text-center shadow-subtle">
      <p className="font-sans-w7 text-cell font-semibold text-ink">
        Nog geen kanaaldata in deze periode
      </p>
      <p className="mx-auto mt-2 max-w-lg text-meta text-ink-muted">
        {laatsteSync
          ? `De laatste sync draaide op ${new Date(laatsteSync).toLocaleString("nl-NL", {
              dateStyle: "long",
              timeStyle: "short",
            })}, maar leverde voor deze periode geen rijen op. Probeer een ruimere periode.`
          : "De nachtelijke sync met Windsor.ai heeft nog niet gedraaid. Zodra hij dat doet, staan de cijfers hier."}
      </p>
    </div>
  );
}
