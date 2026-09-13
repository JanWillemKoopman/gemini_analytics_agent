"use client";

import FilterSelect from "@/components/FilterSelect";
import DataOphalen from "@/components/kanalen/DataOphalen";
import { IconInfo, IconRefresh } from "@/components/icons";
import { PERIODES, type PeriodeKeuze } from "@/lib/kanalen/gebruik";
import { beschikbareWaarden, filter, type Kubus, type Selectie } from "@/lib/kanalen/kubus";

/**
 * De filterbalk boven elke Kanalen-pagina.
 *
 * **Plakt bovenaan** (`sticky top-0`): bij een lange tabel wil je tijdens het scrollen
 * kunnen zien — en wijzigen — op welke selectie je kijkt, zonder eerst terug omhoog te
 * moeten. Dat is ook de reden dat het aantal regels hier staat en niet alleen boven de
 * tabel.
 *
 * De keuzelijsten tonen alleen waarden die in de huidige selectie nog voorkomen: heb je
 * op Instagram gefilterd, dan verdwijnen de campagnes die alleen op Facebook liepen uit
 * de campagnelijst. Een filter aanbieden dat nul rijen oplevert is een doodlopende weg.
 */

export interface FilterDimensie {
  id: string;
  label: string;
}

type Props = {
  kubus: Kubus;
  selectie: Selectie;
  dimensies: FilterDimensie[];
  periode: PeriodeKeuze;
  onPeriode: (periode: PeriodeKeuze) => void;
  onFilter: (dimensie: string, waarden: string[]) => void;
  onWis: () => void;
  aantalActief: number;
  aantalRijen: number;
  aantalTotaal: number;
  uitlegAan: boolean;
  onUitleg: () => void;
  bezig: boolean;
  onHerlaad: () => void;
};

export default function KanalenFilterBalk({
  kubus,
  selectie,
  dimensies,
  periode,
  onPeriode,
  onFilter,
  onWis,
  aantalActief,
  aantalRijen,
  aantalTotaal,
  uitlegAan,
  onUitleg,
  bezig,
  onHerlaad,
}: Props) {
  return (
    <div className="sticky top-0 z-30 -mx-1 mb-5 px-1 pt-1">
      <div className="kaart-omlijst flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-card px-4 py-3 shadow-card">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-sans-w7 text-sm font-semibold text-ink">
              {bezig ? "Laden…" : `${aantalRijen.toLocaleString("nl-NL")} regels`}
            </p>
            <p className="text-meta text-ink-faint">
              {aantalActief > 0 && aantalRijen !== aantalTotaal
                ? "Gefilterde selectie"
                : "Alles in deze periode"}
            </p>
          </div>

          <span aria-hidden="true" className="h-8 w-px bg-line" />

          <div className="flex rounded-control border border-line p-0.5">
            {PERIODES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPeriode(p)}
                className={`whitespace-nowrap rounded-control px-2.5 py-1 text-sm transition-colors duration-[var(--duur-snel)] ease-merk ${
                  p.id === periode.id
                    ? "bg-primary text-on-primary"
                    : "text-ink-muted hover:bg-surface"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center divide-x divide-line">
          {dimensies.map((dim) => {
            // Wat is er nog te kiezen als de ándere filters al toegepast zijn? Het eigen
            // filter telt daarbij niet mee — anders kun je na één keuze geen tweede
            // waarde meer aanvinken.
            const zonderEigen: Selectie = { ...selectie, [dim.id]: [] };
            const opties = beschikbareWaarden(kubus, filter(kubus, zonderEigen), dim.id);
            return (
              <FilterSelect
                key={dim.id}
                label={dim.label}
                options={opties}
                selected={selectie[dim.id] ?? []}
                onChange={(waarden) => onFilter(dim.id, waarden)}
              />
            );
          })}

          <div className="flex items-center gap-1 pl-3">
            <button
              type="button"
              onClick={onUitleg}
              aria-pressed={uitlegAan}
              className={`flex items-center gap-1.5 rounded-control px-2 py-1.5 text-sm font-medium transition-colors duration-[var(--duur-snel)] ${
                uitlegAan
                  ? "bg-primary-light text-primary"
                  : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
            >
              <IconInfo className="h-4 w-4" />
              Zo lees je dit
            </button>

            {/* Twee verschillende acties die makkelijk door elkaar lopen, dus met
                verschillende iconen én een titel: dit pijltje leest de database opnieuw
                (een seconde), "Data ophalen" haalt nieuwe cijfers bij Windsor (minuten). */}
            <button
              type="button"
              onClick={onHerlaad}
              disabled={bezig}
              title="Opnieuw uit de database lezen"
              className="flex items-center gap-1.5 rounded-control px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-[var(--duur-snel)] hover:bg-surface hover:text-ink disabled:opacity-50"
            >
              <IconRefresh className={`h-4 w-4 ${bezig ? "animate-spin" : ""}`} />
            </button>

            <DataOphalen onKlaar={onHerlaad} />

            {aantalActief > 0 && (
              <button
                type="button"
                onClick={onWis}
                className="rounded-control px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary-light"
              >
                Wis filters
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
