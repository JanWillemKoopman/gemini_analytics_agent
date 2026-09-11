"use client";

import { useMemo, useState } from "react";
import Inlogprompt from "@/components/Inlogprompt";
import ActieTabel from "@/components/kennisacties/ActieTabel";
import BerichtFilterBalk, { type BerichtFilters } from "@/components/kennisacties/BerichtFilterBalk";
import BerichtenTabel from "@/components/kennisacties/BerichtenTabel";
import { useCampagneFilters } from "@/lib/campagneFilterContext";
import { initialenVoor } from "@/lib/initialen";
import { SOORTEN, SOORT_LABEL } from "@/lib/notities";
import { useTeamData, type Bericht } from "@/lib/teamData";

const LEGE_FILTERS: BerichtFilters = {
  van: "",
  tot: "",
  initialen: [],
  campagnes: [],
  soorten: [],
};

function sorteerNL(waarden: Iterable<string>): string[] {
  return Array.from(new Set(waarden))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "nl"));
}

/** Vergelijkt op kalenderdag: een datumfilter hoort de hele dag mee te nemen. */
function opDag(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${datum.getFullYear()}-${maand}-${dag}`;
}

/**
 * Het tabblad "Kennis en acties": de inhoud van wat het team heeft vastgelegd. Bovenin
 * alle berichten (observaties, hypotheses, besluiten, acties) met dezelfde velden als
 * filter; daaronder een aparte tabel met alleen de acties, die daar ook af te vinken
 * zijn.
 *
 * De puntentelling die hier vroeger boven stond, staat nu op het tabblad "Scores". Dat
 * zijn twee verschillende vragen: "wat hebben we geleerd en wat moet er nog gebeuren?"
 * hoort bij de inhoud, "hoe staan we ervoor?" bij de stand. Ze delen wel exact dezelfde
 * rijen (`TeamDataProvider`), dus een net vastgelegd bericht verschijnt hier én telt daar
 * onmiddellijk mee.
 */
export default function KennisEnActies() {
  const { campagnes } = useCampagneFilters();
  const { ingelogd, berichten, profielPerId, laden, fout, seizoen } = useTeamData();
  const [filters, setFilters] = useState<BerichtFilters>(LEGE_FILTERS);

  const bekendeCampagnes = useMemo(() => new Set(campagnes.map((c) => c.naam)), [campagnes]);

  const opties = useMemo(
    () => ({
      initialen: sorteerNL(
        berichten.map((b) => initialenVoor(profielPerId[b.aangemaaktDoor]?.naam ?? null)),
      ),
      campagnes: sorteerNL(berichten.map((b) => b.campagneNaam)),
      soorten: SOORTEN.map((s) => s.label),
    }),
    [berichten, profielPerId],
  );

  /** Alle filters behalve het soort — dat laatste is voor de actietabel betekenisloos. */
  const past = useMemo(
    () =>
      (bericht: Bericht): boolean => {
        const dag = opDag(bericht.aangemaaktOp);
        if (filters.van && dag < filters.van) return false;
        if (filters.tot && dag > filters.tot) return false;
        if (
          filters.initialen.length > 0 &&
          !filters.initialen.includes(
            initialenVoor(profielPerId[bericht.aangemaaktDoor]?.naam ?? null),
          )
        ) {
          return false;
        }
        if (filters.campagnes.length > 0 && !filters.campagnes.includes(bericht.campagneNaam)) {
          return false;
        }
        return true;
      },
    [filters, profielPerId],
  );

  const getoond = useMemo(
    () =>
      berichten.filter(
        (bericht) =>
          past(bericht) &&
          (filters.soorten.length === 0 || filters.soorten.includes(SOORT_LABEL[bericht.soort])),
      ),
    [berichten, filters.soorten, past],
  );

  // De actietabel volgt dezelfde filterbalk, maar negeert "Type bericht": daar staan
  // per definitie alleen acties in, dus filteren op soort zou hem alleen maar leeg
  // kunnen maken zonder dat je begrijpt waarom.
  const acties = useMemo(
    () => berichten.filter((bericht) => bericht.soort === "actie" && past(bericht)),
    [berichten, past],
  );

  const actieveFilters =
    (filters.van ? 1 : 0) +
    (filters.tot ? 1 : 0) +
    filters.initialen.length +
    filters.campagnes.length +
    filters.soorten.length;

  if (!ingelogd) {
    return (
      <Inlogprompt tekst="Log in om te zien wat het team heeft vastgelegd en om zelf iets toe te voegen." />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fout && (
        <p className="rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">
          {fout}
        </p>
      )}

      <BerichtFilterBalk
        totaal={berichten.length}
        getoond={getoond.length}
        filters={filters}
        opties={opties}
        onChange={setFilters}
        onWis={() => setFilters(LEGE_FILTERS)}
        actieveFilters={actieveFilters}
      />

      <BerichtenTabel
        berichten={getoond}
        profielen={profielPerId}
        bekendeCampagnes={bekendeCampagnes}
        medailles={seizoen.huidige.medailles}
        laden={laden}
      />

      <ActieTabel acties={acties} />
    </div>
  );
}
