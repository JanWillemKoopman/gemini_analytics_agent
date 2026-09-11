"use client";

import { useEffect, useMemo, useState } from "react";
import BerichtFilterBalk, { type BerichtFilters } from "@/components/kennisacties/BerichtFilterBalk";
import BerichtenTabel from "@/components/kennisacties/BerichtenTabel";
import NieuwBerichtZijbalk from "@/components/kennisacties/NieuwBerichtZijbalk";
import Scorebord from "@/components/kennisacties/Scorebord";
import type { Bericht, Profiel } from "@/components/kennisacties/types";
import { IconPlus } from "@/components/icons";
import { useCampagneFilters } from "@/lib/campagneFilterContext";
import { initialenVoor } from "@/lib/initialen";
import { SOORTEN, SOORT_LABEL } from "@/lib/notities";
import type { PuntenPeriode } from "@/lib/punten";

type Props = {
  ingelogd: boolean;
  eigenNaam: string | null;
  eigenAvatarUrl: string | null;
};

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
 * Het tabblad "Kennis en acties": alles wat het team bij campagnes heeft vastgelegd, op
 * één plek, met bovenaan de stand per collega.
 *
 * Waarom dit naast het logboek per campagne bestaat: daar staat de kennis per kolom en
 * moet je hem gaan zoeken. Hier zie je in één blik wat er de afgelopen weken is
 * opgevallen, bedacht, besloten en opgepakt — over campagnes heen, inclusief inzichten
 * die aan geen enkele campagne hangen.
 *
 * De "+"-knop hangt bewust in dit component (en niet in `AppShell`, zoals die voor een
 * nieuwe campagne): het net opgeslagen bericht moet meteen in de tabel en in het
 * scorebord verschijnen, en die state woont hier.
 */
export default function KennisEnActies({ ingelogd, eigenNaam, eigenAvatarUrl }: Props) {
  const { campagnes } = useCampagneFilters();
  const [items, setItems] = useState<Bericht[] | null>(null);
  const [profielen, setProfielen] = useState<Profiel[]>([]);
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [filters, setFilters] = useState<BerichtFilters>(LEGE_FILTERS);
  const [periode, setPeriode] = useState<PuntenPeriode>(30);
  const [zijbalkOpen, setZijbalkOpen] = useState(false);

  useEffect(() => {
    if (!ingelogd) return;
    let genegeerd = false;
    setLaden(true);
    setFout(null);
    fetch("/api/kennis-en-acties")
      .then((res) => res.json())
      .then((json) => {
        if (genegeerd) return;
        if (json.fout) throw new Error(json.fout);
        setItems(json.items as Bericht[]);
        setProfielen(json.profielen as Profiel[]);
      })
      .catch((err) => {
        if (!genegeerd) setFout(err instanceof Error ? err.message : "Kon de berichten niet ophalen.");
      })
      .finally(() => {
        if (!genegeerd) setLaden(false);
      });
    return () => {
      genegeerd = true;
    };
  }, [ingelogd]);

  const profielPerId = useMemo(() => {
    const map: Record<string, Profiel> = {};
    for (const profiel of profielen) map[profiel.id] = profiel;
    return map;
  }, [profielen]);

  const bekendeCampagnes = useMemo(() => new Set(campagnes.map((c) => c.naam)), [campagnes]);

  const alles = useMemo(() => items ?? [], [items]);

  const opties = useMemo(
    () => ({
      initialen: sorteerNL(
        alles.map((b) => initialenVoor(profielPerId[b.aangemaaktDoor]?.naam ?? null)),
      ),
      campagnes: sorteerNL(alles.map((b) => b.campagneNaam)),
      soorten: SOORTEN.map((s) => s.label),
    }),
    [alles, profielPerId],
  );

  const getoond = useMemo(
    () =>
      alles.filter((bericht) => {
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
        if (filters.soorten.length > 0 && !filters.soorten.includes(SOORT_LABEL[bericht.soort])) {
          return false;
        }
        return true;
      }),
    [alles, filters, profielPerId],
  );

  const actieveFilters =
    (filters.van ? 1 : 0) +
    (filters.tot ? 1 : 0) +
    filters.initialen.length +
    filters.campagnes.length +
    filters.soorten.length;

  function verwerkNieuw(bericht: Bericht, profiel: Profiel | null) {
    setItems((huidig) => [bericht, ...(huidig ?? [])]);
    if (profiel && !profielPerId[profiel.id]) {
      setProfielen((huidig) => [...huidig, profiel]);
    }
  }

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-card px-5 py-6 shadow-card">
        <p className="text-sm text-ink-muted">
          Log in om te zien wat het team heeft vastgelegd en om zelf iets toe te voegen.
        </p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Scorebord
        berichten={alles}
        profielen={profielen}
        periode={periode}
        onPeriode={setPeriode}
      />

      {fout && (
        <p className="rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">{fout}</p>
      )}

      <BerichtFilterBalk
        totaal={alles.length}
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
        laden={laden && items === null}
      />

      {/* Zelfde ronde "+" rechtsonder als op de campagnetabbladen, met hetzelfde gedrag:
          vaste plek in het scherm, ongeacht scrollpositie. */}
      <button
        type="button"
        onClick={() => setZijbalkOpen(true)}
        aria-label="Bericht toevoegen"
        title="Bericht toevoegen"
        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary opacity-85 shadow-dropdown transition-opacity duration-150 hover:opacity-100"
      >
        <IconPlus className="h-5 w-5" />
      </button>

      {zijbalkOpen && (
        <NieuwBerichtZijbalk
          ingelogd={ingelogd}
          campagnes={sorteerNL(campagnes.map((c) => c.naam))}
          eigenNaam={eigenNaam}
          eigenAvatarUrl={eigenAvatarUrl}
          onClose={() => setZijbalkOpen(false)}
          onToegevoegd={verwerkNieuw}
        />
      )}
    </div>
  );
}
