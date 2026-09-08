"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isCampagneLive } from "@/lib/format";
import type { Campagne } from "@/lib/sheet";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "nl"));
}

/** Zelfde twee waardes als StatusIndicator toont — afgeleid van start-/einddatum, niet
 *  van de kolom "Status" in de sheet. */
const STATUS_OPTIES = ["Online", "Offline"] as const;

function statusLabel(campagne: Campagne): (typeof STATUS_OPTIES)[number] {
  return isCampagneLive(campagne) ? "Online" : "Offline";
}

type Opties = { status: string[]; merk: string[]; ordersoort: string[]; klantgroep: string[] };

type CampagneFilterContextValue = {
  campagnes: Campagne[];
  filtered: Campagne[];
  options: Opties;
  status: string[];
  setStatus: (waarden: string[]) => void;
  merk: string[];
  setMerk: (waarden: string[]) => void;
  ordersoort: string[];
  setOrdersoort: (waarden: string[]) => void;
  klantgroep: string[];
  setKlantgroep: (waarden: string[]) => void;
  uitlegAan: boolean;
  setUitlegAan: (waarde: boolean | ((vorige: boolean) => boolean)) => void;
  activeFilterCount: number;
  clearAll: () => void;
  /** Werkt één veld van één campagne direct in de lokale kopie bij, zonder op een
   * volledige serverrefresh (en dus een nieuwe ophaal van de hele sheet) te wachten —
   * de schrijfbare velden in de tabel gebruiken dit voor directe feedback na opslaan. */
  werkVeldBij: (campagneNaam: string, patch: Partial<Campagne>) => void;
  /** Voegt een net in de sheet aangemaakte campagne ook lokaal toe, zodat hij meteen
   * zichtbaar is in de tabel, tijdlijn en het beheeroverzicht zonder serverrefresh. */
  voegCampagneToe: (campagne: Campagne) => void;
};

const CampagneFilterContext = createContext<CampagneFilterContextValue | null>(null);

/**
 * Houdt de filterselectie (status/merk/ordersoort/klantgroep) en de "Zo lees je dit"-
 * toggle centraal bij, zodat het tabblad Campagnes en het tabblad Tijdlijn dezelfde
 * filterbalk en dezelfde selectie delen in plaats van elk hun eigen state bij te
 * houden. Wrap beide tabbladen (via `AppShell`'s props) in deze provider.
 */
export function CampagneFilterProvider({
  campagnes: campagnesProp,
  children,
}: {
  campagnes: Campagne[];
  children: ReactNode;
}) {
  // Lokale kopie i.p.v. de prop direct gebruiken: zo kan `werkVeldBij` een net
  // opgeslagen wijziging meteen laten zien zonder op een serverrefresh te wachten. Bij
  // een echte refresh (navigatie, of de "Data updaten"-knop) komt er een nieuwe prop
  // binnen, en die synct hieronder terug in de lokale kopie.
  const [campagnes, setCampagnes] = useState(campagnesProp);
  useEffect(() => {
    setCampagnes(campagnesProp);
  }, [campagnesProp]);

  // Standaard alleen "Online" tonen, net als voorheen — nu berekend i.p.v. uit de sheet gelezen.
  const [status, setStatus] = useState<string[]>(["Online"]);
  const [merk, setMerk] = useState<string[]>([]);
  const [ordersoort, setOrdersoort] = useState<string[]>([]);
  const [klantgroep, setKlantgroep] = useState<string[]>([]);
  const [uitlegAan, setUitlegAan] = useState(false);

  function werkVeldBij(campagneNaam: string, patch: Partial<Campagne>) {
    setCampagnes((huidig) =>
      huidig.map((c) => (c.naam === campagneNaam ? { ...c, ...patch } : c)),
    );
  }

  function voegCampagneToe(campagne: Campagne) {
    setCampagnes((huidig) => [...huidig, campagne]);
  }

  const options = useMemo<Opties>(
    () => ({
      status: [...STATUS_OPTIES],
      merk: uniqueSorted(campagnes.map((c) => c.merk)),
      ordersoort: uniqueSorted(campagnes.map((c) => c.ordersoort)),
      klantgroep: uniqueSorted(campagnes.map((c) => c.klantgroepOrders)),
    }),
    [campagnes],
  );

  const filtered = useMemo(
    () =>
      campagnes.filter(
        (c) =>
          (status.length === 0 || status.includes(statusLabel(c))) &&
          (merk.length === 0 || merk.includes(c.merk)) &&
          (ordersoort.length === 0 || ordersoort.includes(c.ordersoort)) &&
          (klantgroep.length === 0 || klantgroep.includes(c.klantgroepOrders)),
      ),
    [campagnes, status, merk, ordersoort, klantgroep],
  );

  const activeFilterCount = status.length + merk.length + ordersoort.length + klantgroep.length;

  function clearAll() {
    setStatus([]);
    setMerk([]);
    setOrdersoort([]);
    setKlantgroep([]);
  }

  const value: CampagneFilterContextValue = {
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
    werkVeldBij,
    voegCampagneToe,
  };

  return <CampagneFilterContext.Provider value={value}>{children}</CampagneFilterContext.Provider>;
}

export function useCampagneFilters(): CampagneFilterContextValue {
  const context = useContext(CampagneFilterContext);
  if (!context) {
    throw new Error("useCampagneFilters moet binnen een CampagneFilterProvider gebruikt worden");
  }
  return context;
}
