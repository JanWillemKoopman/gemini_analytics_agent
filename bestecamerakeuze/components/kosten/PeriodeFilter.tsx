"use client";

import { useEffect, useRef, useState } from "react";

export interface Periode {
  van: string; // YYYY-MM-DD
  tot: string; // YYYY-MM-DD
}

function vandaag(): string {
  return new Date().toISOString().slice(0, 10);
}

function dagenGeleden(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function eersteVanDeMaand(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const PRESETS: { label: string; periode: () => Periode }[] = [
  { label: "Laatste 7 dagen", periode: () => ({ van: dagenGeleden(6), tot: vandaag() }) },
  { label: "Laatste 30 dagen", periode: () => ({ van: dagenGeleden(29), tot: vandaag() }) },
  { label: "Laatste 90 dagen", periode: () => ({ van: dagenGeleden(89), tot: vandaag() }) },
  { label: "Deze maand", periode: () => ({ van: eersteVanDeMaand(), tot: vandaag() }) },
];

/** Herkent een preset in de huidige periode, zodat de knop het juiste label toont. */
function herkenLabel(periode: Periode): string {
  const preset = PRESETS.find((p) => {
    const berekend = p.periode();
    return berekend.van === periode.van && berekend.tot === periode.tot;
  });
  return preset?.label ?? "Aangepaste periode";
}

export default function PeriodeFilter({
  periode,
  onChange,
}: {
  periode: Periode;
  onChange: (periode: Periode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [aangepastVan, setAangepastVan] = useState(periode.van);
  const [aangepastTot, setAangepastTot] = useState(periode.tot);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAangepastVan(periode.van);
    setAangepastTot(periode.tot);
  }, [periode.van, periode.tot]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-button border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary"
      >
        {herkenLabel(periode)}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-card border border-line bg-card p-2 shadow-lg">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                onChange(p.periode());
                setOpen(false);
              }}
              className="block w-full rounded px-2.5 py-1.5 text-left text-sm text-ink hover:bg-page"
            >
              {p.label}
            </button>
          ))}

          <div className="mt-1 border-t border-line px-2.5 pt-2 pb-1">
            <p className="pb-1.5 text-xs tracking-wide text-ink-faint uppercase">
              Aangepaste periode
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={aangepastVan}
                max={aangepastTot}
                onChange={(e) => setAangepastVan(e.target.value)}
                className="min-w-0 flex-1 rounded-card border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              />
              <span className="text-ink-faint">–</span>
              <input
                type="date"
                value={aangepastTot}
                min={aangepastVan}
                max={vandaag()}
                onChange={(e) => setAangepastTot(e.target.value)}
                className="min-w-0 flex-1 rounded-card border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onChange({ van: aangepastVan, tot: aangepastTot });
                setOpen(false);
              }}
              className="mt-2 w-full rounded-button bg-primary px-3 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
            >
              Toepassen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
