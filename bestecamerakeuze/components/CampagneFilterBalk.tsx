"use client";

import FilterBar from "@/components/FilterBar";
import FilterSelect from "@/components/FilterSelect";
import UpdateButton from "@/components/UpdateButton";
import { IconInfo } from "@/components/icons";
import { useCampagneFilters } from "@/lib/campagneFilterContext";

/**
 * De filterbalk die boven zowel het tabblad Campagnes als het tabblad Tijdlijn staat:
 * status/merk/ordersoort/klantgroep, "Zo lees je dit", "Data updaten" en "Wis filters".
 * Eén component zodat de balk er op beide tabbladen identiek uitziet en de selectie via
 * `useCampagneFilters()` gedeeld blijft.
 */
export default function CampagneFilterBalk() {
  const {
    campagnes,
    filtered,
    options,
    status,
    setStatus,
    merk,
    setMerk,
    ordersoort,
    setOrdersoort,
    klantgroep,
    setKlantgroep,
    uitlegAan,
    setUitlegAan,
    activeFilterCount,
    clearAll,
  } = useCampagneFilters();

  return (
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
      <FilterSelect label="Klantgroep" options={options.klantgroep} selected={klantgroep} onChange={setKlantgroep} />
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
  );
}
