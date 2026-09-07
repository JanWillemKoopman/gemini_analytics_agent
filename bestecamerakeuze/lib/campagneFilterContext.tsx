"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Campagne } from "@/lib/sheet";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "nl"));
}

/** Zoekt de exacte schrijfwijze van "Online" op zoals die in de sheet staat, zodat de
 * default-filter altijd matcht met de waardes in `options.status`. */
function vindOnlineWaarde(campagnes: Campagne[]): string | null {
  const gevonden = campagnes.find((c) => c.status.trim().toLowerCase() === "online");
  return gevonden ? gevonden.status.trim() : null;
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
};

const CampagneFilterContext = createContext<CampagneFilterContextValue | null>(null);

/**
 * Houdt de filterselectie (status/merk/ordersoort/klantgroep) en de "Zo lees je dit"-
 * toggle centraal bij, zodat het tabblad Campagnes en het tabblad Tijdlijn dezelfde
 * filterbalk en dezelfde selectie delen in plaats van elk hun eigen state bij te
 * houden. Wrap beide tabbladen (via `AppShell`'s props) in deze provider.
 */
export function CampagneFilterProvider({
  campagnes,
  children,
}: {
  campagnes: Campagne[];
  children: ReactNode;
}) {
  const [status, setStatus] = useState<string[]>(() => {
    const online = vindOnlineWaarde(campagnes);
    return online ? [online] : [];
  });
  const [merk, setMerk] = useState<string[]>([]);
  const [ordersoort, setOrdersoort] = useState<string[]>([]);
  const [klantgroep, setKlantgroep] = useState<string[]>([]);
  const [uitlegAan, setUitlegAan] = useState(false);

  const options = useMemo<Opties>(
    () => ({
      status: uniqueSorted(campagnes.map((c) => c.status)),
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
          (status.length === 0 || status.includes(c.status)) &&
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
