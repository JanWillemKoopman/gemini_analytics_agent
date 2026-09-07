"use client";

import { useMemo, useState } from "react";
import type { Campagne } from "@/lib/sheet";
import CampagneFocus from "@/components/CampagneFocus";
import CampaignTable from "@/components/CampaignTable";
import FilterBar from "@/components/FilterBar";
import FilterSelect from "@/components/FilterSelect";
import UpdateButton from "@/components/UpdateButton";
import { IconInfo } from "@/components/icons";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "nl"));
}

/** Hoogste (meest recente) startdatum links; ontbrekende startdatum helemaal achteraan. */
function sortByStartdatumDesc(campagnes: Campagne[]): Campagne[] {
  return [...campagnes].sort((a, b) => (b.startdatum ?? "").localeCompare(a.startdatum ?? ""));
}

type Props = {
  campagnes: Campagne[];
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
};

/** Zoekt de exacte schrijfwijze van "Online" op zoals die in de sheet staat, zodat de
 * default-filter altijd matcht met de waardes in `options.status`. */
function vindOnlineWaarde(campagnes: Campagne[]): string | null {
  const gevonden = campagnes.find((c) => c.status.trim().toLowerCase() === "online");
  return gevonden ? gevonden.status.trim() : null;
}

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

export default function CampaignDashboard({ campagnes, notitiesBeschikbaar, ingelogd }: Props) {
  // Filter Status staat standaard op "Online", zodat je bij het openen van het dashboard
  // meteen de lopende campagnes ziet in plaats van alles inclusief offline campagnes.
  const [status, setStatus] = useState<string[]>(() => {
    const online = vindOnlineWaarde(campagnes);
    return online ? [online] : [];
  });
  const [merk, setMerk] = useState<string[]>([]);
  const [ordersoort, setOrdersoort] = useState<string[]>([]);
  const [klantgroep, setKlantgroep] = useState<string[]>([]);
  const [focusNaam, setFocusNaam] = useState<string | null>(null);
  const [uitlegAan, setUitlegAan] = useState(false);

  const options = useMemo(
    () => ({
      status: uniqueSorted(campagnes.map((c) => c.status)),
      merk: uniqueSorted(campagnes.map((c) => c.merk)),
      ordersoort: uniqueSorted(campagnes.map((c) => c.ordersoort)),
      klantgroep: uniqueSorted(campagnes.map((c) => c.klantgroepOrders)),
    }),
    [campagnes],
  );

  const filtered = useMemo(() => {
    const result = campagnes.filter(
      (c) =>
        (status.length === 0 || status.includes(c.status)) &&
        (merk.length === 0 || merk.includes(c.merk)) &&
        (ordersoort.length === 0 || ordersoort.includes(c.ordersoort)) &&
        (klantgroep.length === 0 || klantgroep.includes(c.klantgroepOrders)),
    );
    return sortByStartdatumDesc(result);
  }, [campagnes, status, merk, ordersoort, klantgroep]);

  // De focus wordt uit de gefilterde lijst afgeleid in plaats van apart bijgehouden:
  // filtert iemand de campagne in focus weg, dan verdwijnt het focuspaneel vanzelf.
  const focusCampagne = focusNaam ? (filtered.find((c) => c.naam === focusNaam) ?? null) : null;

  const activeFilterCount = status.length + merk.length + ordersoort.length + klantgroep.length;

  function clearAll() {
    setStatus([]);
    setMerk([]);
    setOrdersoort([]);
    setKlantgroep([]);
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        totalCount={campagnes.length}
        filteredCount={filtered.length}
        activeFilterCount={activeFilterCount}
        onClearAll={clearAll}
      >
        <FilterSelect label="Status" options={options.status} selected={status} onChange={setStatus} />
        <FilterSelect label="Merk" options={options.merk} selected={merk} onChange={setMerk} />
        <FilterSelect
          label="Ordersoort"
          options={options.ordersoort}
          selected={ordersoort}
          onChange={setOrdersoort}
        />
        {/* Kolomkop in de sheet is "Klantgroep orders (indien van toepassing)"; in de UI
            afgekort tot "Klantgroep". */}
        <FilterSelect
          label="Klantgroep"
          options={options.klantgroep}
          selected={klantgroep}
          onChange={setKlantgroep}
        />
        <div className="pl-3">
          <button
            type="button"
            onClick={() => setUitlegAan((aan) => !aan)}
            aria-pressed={uitlegAan}
            className={`flex items-center gap-1.5 rounded-control px-2 py-1.5 text-sm font-medium transition-colors ${
              uitlegAan ? "bg-primary-light text-primary" : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <IconInfo className="h-4 w-4" />
            Zo lees je dit
          </button>
        </div>
        <UpdateButton variant="inline" label="Data updaten" />
      </FilterBar>

      {uitlegAan && <Leeswijzer />}

      <CampaignTable
        campagnes={filtered}
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
