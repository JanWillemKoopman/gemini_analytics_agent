"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { IconCheck, IconEye } from "@/components/icons";
import { THEMES } from "@/lib/themes";

/**
 * Het oogje rechtsboven in het scherm: klik erop en je kiest de vormgeving van het hele
 * dashboard — de huisstijl van Udenhout zelf of die van een van de merken uit de
 * Volkswagen Groep.
 *
 * Bewust een klein, rustig knopje: het is een kijkinstelling, geen dashboardfunctie, en
 * mag dus niet met de data concurreren. Vandaar het oog-icoon en niet een gekleurde
 * knop. Staat `fixed` in de hoek zodat hij op elk tabblad en tijdens scrollen op
 * dezelfde plek blijft.
 */
export default function ThemeSwitcher() {
  const { theme, kiesTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function buitenKlik(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", buitenKlik);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", buitenKlik);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <div ref={ref} className="fixed right-4 top-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Vormgeving kiezen"
        title="Vormgeving kiezen"
        className={`flex h-9 w-9 items-center justify-center rounded-control border border-line bg-card text-ink-muted shadow-card transition-colors duration-150 hover:text-ink ${
          open ? "text-ink" : ""
        }`}
      >
        <IconEye className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Vormgeving"
          className="absolute right-0 mt-2 w-[272px] overflow-hidden rounded-card border border-line bg-card p-1.5 shadow-dropdown"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-label font-semibold uppercase tracking-wide text-ink-faint">
            Vormgeving
          </p>

          {THEMES.map((t) => {
            const actief = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                aria-checked={actief}
                onClick={() => {
                  kiesTheme(t.id);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-control px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface ${
                  actief ? "bg-surface" : ""
                }`}
              >
                {/* Drie staaltjes: vlak, inkt, accent — genoeg om het merk te herkennen
                    zonder het logo te hoeven tonen. */}
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex shrink-0 overflow-hidden rounded-control border border-line"
                >
                  {t.staal.map((kleur) => (
                    <span key={kleur} className="block h-4 w-4" style={{ background: kleur }} />
                  ))}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">{t.naam}</span>
                    {actief && <IconCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </span>
                  <span className="mt-0.5 block text-label leading-snug text-ink-faint">
                    {t.omschrijving}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
