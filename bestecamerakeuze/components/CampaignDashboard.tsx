"use client";

import { useMemo, useState } from "react";
import type { Campagne } from "@/lib/sheet";
import CampagneFocus from "@/components/CampagneFocus";
import CampagneFilterBalk from "@/components/CampagneFilterBalk";
import CampaignTable from "@/components/CampaignTable";
import { useCampagneFilters } from "@/lib/campagneFilterContext";

/** Hoogste (meest recente) startdatum links; ontbrekende startdatum helemaal achteraan. */
function sortByStartdatumDesc(campagnes: Campagne[]): Campagne[] {
  return [...campagnes].sort((a, b) => (b.startdatum ?? "").localeCompare(a.startdatum ?? ""));
}

type Props = {
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
};

/**
 * "Zo lees je dit": de leeswijzer boven de tabel.
 *
 * Data-gedreven werken struikelt vaker over onbegrip dan over onwil — wie niet zeker
 * weet wat een rij betekent, stelt geen vraag maar zwijgt. Deze uitleg staat daarom in
 * het dashboard zelf en niet in een handleiding, en staat standaard uit zodat hij voor
 * wie hem niet meer nodig heeft ook echt weg is.
 */
function Leeswijzer() {
  return (
    <div className="rounded-panel border border-line bg-surface px-5 py-4">
      <p className="font-sans-w7 text-sm font-bold text-ink">Zo lees je deze tabel</p>
      <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-muted">
        <li>
          <span className="font-medium text-ink">Elke kolom is een campagne</span>, elke rij een
          cijfer. Zo staan campagnes naast elkaar en vergelijk je ze in één oogopslag.
        </li>
        <li>
          <span className="font-medium text-ink">De grote waarde</span> is het cijfer zelf; de
          kleine regel eronder zegt hoe dat zich verhoudt tot het doel. Groen is boven doel, rood
          eronder.
        </li>
        <li>
          <span className="font-medium text-ink">Een balkje</span> verschijnt alleen als er een echt
          doel is afgesproken. Staat er een streepje, dan ontbreekt dat doel in de sheet.
        </li>
        <li>
          <span className="font-medium text-ink">Klik op een campagnenaam</span> om alles over die
          campagne bij elkaar te zien, inclusief het logboek met besluiten.
        </li>
      </ul>
    </div>
  );
}

export default function CampaignDashboard({ notitiesBeschikbaar, ingelogd }: Props) {
  const { filtered, uitlegAan } = useCampagneFilters();
  const [focusNaam, setFocusNaam] = useState<string | null>(null);

  const sorted = useMemo(() => sortByStartdatumDesc(filtered), [filtered]);

  // De focus wordt uit de gefilterde lijst afgeleid in plaats van apart bijgehouden:
  // filtert iemand de campagne in focus weg, dan verdwijnt het focuspaneel vanzelf.
  const focusCampagne = focusNaam ? (sorted.find((c) => c.naam === focusNaam) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <CampagneFilterBalk />

      {uitlegAan && <Leeswijzer />}

      <CampaignTable
        campagnes={sorted}
        notitiesBeschikbaar={notitiesBeschikbaar}
        ingelogd={ingelogd}
        focus={focusCampagne?.naam ?? null}
        onFocus={setFocusNaam}
        uitlegAan={uitlegAan}
      />

      {focusCampagne && (
        <CampagneFocus
          // key: bij wisselen van campagne moet het logboek opnieuw laden in plaats van
          // de aantekeningen van de vorige campagne te blijven tonen.
          key={focusCampagne.naam}
          campagne={focusCampagne}
          notitiesBeschikbaar={notitiesBeschikbaar}
          ingelogd={ingelogd}
          onSluit={() => setFocusNaam(null)}
        />
      )}
    </div>
  );
}
