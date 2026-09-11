"use client";

import FilterSelect from "@/components/FilterSelect";
import { IconNotes } from "@/components/icons";

export type BerichtFilters = {
  van: string;
  tot: string;
  initialen: string[];
  campagnes: string[];
  soorten: string[];
};

type Props = {
  totaal: number;
  getoond: number;
  filters: BerichtFilters;
  opties: { initialen: string[]; campagnes: string[]; soorten: string[] };
  onChange: (filters: BerichtFilters) => void;
  onWis: () => void;
  actieveFilters: number;
};

/** Dezelfde datumcontrol-vorm als FilterSelect: klein label erboven, waarde eronder. */
function Datumveld({
  label,
  waarde,
  onChange,
}: {
  label: string;
  waarde: string;
  onChange: (waarde: string) => void;
}) {
  return (
    <label className="flex flex-col items-start gap-0.5 rounded-control px-3 py-1.5 transition-colors duration-[var(--duur-snel)] hover:bg-surface">
      <span className="label-theme text-label text-ink-faint">{label}</span>
      <input
        type="date"
        value={waarde}
        onChange={(e) => onChange(e.target.value)}
        className="w-[118px] bg-transparent text-sm font-medium text-ink outline-none"
      />
    </label>
  );
}

/**
 * De filterbalk boven de berichtentabel: dezelfde velden als de kolommen erin, op "het
 * bericht zelf" na — daar filter je niet op, dat lees je.
 *
 * Eén samenhangende balk (aantal links, filters rechts), net als boven de campagnetabel,
 * in plaats van losse knoppen verspreid over de pagina.
 */
export default function BerichtFilterBalk({
  totaal,
  getoond,
  filters,
  opties,
  onChange,
  onWis,
  actieveFilters,
}: Props) {
  const gefilterd = actieveFilters > 0 && getoond !== totaal;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-card px-4 py-3 shadow-subtle">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface text-ink-muted">
          <IconNotes className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            {getoond} {getoond === 1 ? "bericht" : "berichten"}
          </p>
          <p className="text-xs text-ink-faint">
            {gefilterd ? "Gefilterde selectie" : "Alles wat het team vastlegde"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center divide-x divide-line">
        <div className="flex items-center gap-1 pr-1">
          <Datumveld
            label="Van"
            waarde={filters.van}
            onChange={(van) => onChange({ ...filters, van })}
          />
          <Datumveld
            label="Tot"
            waarde={filters.tot}
            onChange={(tot) => onChange({ ...filters, tot })}
          />
        </div>
        <div className="pl-1">
          <FilterSelect
            label="Initialen"
            options={opties.initialen}
            selected={filters.initialen}
            onChange={(initialen) => onChange({ ...filters, initialen })}
          />
        </div>
        <div className="pl-1">
          <FilterSelect
            label="Campagne"
            options={opties.campagnes}
            selected={filters.campagnes}
            onChange={(campagnes) => onChange({ ...filters, campagnes })}
          />
        </div>
        <div className="pl-1">
          <FilterSelect
            label="Type bericht"
            options={opties.soorten}
            selected={filters.soorten}
            onChange={(soorten) => onChange({ ...filters, soorten })}
          />
        </div>
        {actieveFilters > 0 && (
          <div className="pl-3">
            <button
              type="button"
              onClick={onWis}
              className="rounded-control px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary-light"
            >
              Wis filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
