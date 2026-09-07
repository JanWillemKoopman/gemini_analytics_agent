"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Campagne } from "@/lib/sheet";
import CampagneFilterBalk from "@/components/CampagneFilterBalk";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCampagneFilters } from "@/lib/campagneFilterContext";

type Week = {
  nummer: number;
  /** Maandag van deze ISO-week — bepaalt in welke kolom een campagnedatum valt. */
  start: Date;
};

const MIN_KOLOMBREEDTE = 14;
const MAX_KOLOMBREEDTE = 44;
const STANDAARD_KOLOMBREEDTE = 24;
const NAAMKOLOM = 220;
const RIJHOOGTE = 40;
const KOPHOOGTE = 56;

/** Maandag van de ISO-week waarin `date` valt. */
function maandagVan(date: Date): Date {
  const kopie = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dag = kopie.getUTCDay() || 7;
  if (dag !== 1) kopie.setUTCDate(kopie.getUTCDate() - (dag - 1));
  return kopie;
}

/** Alle maandagen van ISO-week 1 t/m 52 van `jaar`. */
function bouwWeken(jaar: number): Week[] {
  const eersteDonderdag = new Date(Date.UTC(jaar, 0, 4));
  const week1Maandag = maandagVan(eersteDonderdag);
  return Array.from({ length: 52 }, (_, i) => {
    const start = new Date(week1Maandag);
    start.setUTCDate(start.getUTCDate() + i * 7);
    return { nummer: i + 1, start };
  });
}

function parseDatum(waarde: string | null): Date | null {
  if (!waarde) return null;
  const date = new Date(waarde);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Het jaar waarin de meeste campagnes starten — daarop richten we de assen; bij gebrek aan data het huidige jaar. */
function bepaalAsJaar(campagnes: Campagne[]): number {
  const telling = new Map<number, number>();
  for (const c of campagnes) {
    const start = parseDatum(c.startdatum);
    if (!start) continue;
    telling.set(start.getFullYear(), (telling.get(start.getFullYear()) ?? 0) + 1);
  }
  let beste: number | null = null;
  let besteAantal = 0;
  for (const [jaar, aantal] of telling) {
    if (aantal > besteAantal) {
      beste = jaar;
      besteAantal = aantal;
    }
  }
  return beste ?? new Date().getFullYear();
}

type Balk = {
  campagne: Campagne;
  vanKolom: number;
  totKolom: number;
};

/** Zet start-/einddatum om naar een kolomrange binnen 1..52; valt de periode buiten het jaar dan geen balk. */
function bepaalBalk(campagne: Campagne, weken: Week[]): Balk | null {
  const start = parseDatum(campagne.startdatum);
  const eind = parseDatum(campagne.einddatum) ?? start;
  if (!start || !eind) return null;

  const jaarStart = weken[0].start;
  const jaarEind = new Date(weken[weken.length - 1].start);
  jaarEind.setUTCDate(jaarEind.getUTCDate() + 7);
  if (eind < jaarStart || start >= jaarEind) return null;

  const kolomVoor = (datum: Date): number => {
    let index = weken.findIndex((week, i) => {
      const volgende = weken[i + 1]?.start;
      return datum >= week.start && (!volgende || datum < volgende);
    });
    if (index === -1) index = datum < jaarStart ? 0 : weken.length - 1;
    return index + 1;
  };

  const vanKolom = kolomVoor(start < jaarStart ? jaarStart : start);
  const totKolom = kolomVoor(eind >= jaarEind ? new Date(jaarEind.getTime() - 1) : eind);
  return { campagne, vanKolom, totKolom: Math.max(vanKolom, totKolom) };
}

/** Positie van vandaag als (fractionele) kolomindex, of null als vandaag buiten dit jaaroverzicht valt. */
function bepaalVandaagPositie(vandaag: Date, weken: Week[]): number | null {
  const jaarStart = weken[0].start;
  const jaarEind = new Date(weken[weken.length - 1].start);
  jaarEind.setUTCDate(jaarEind.getUTCDate() + 7);
  if (vandaag < jaarStart || vandaag >= jaarEind) return null;

  const index = weken.findIndex((week, i) => {
    const volgende = weken[i + 1]?.start;
    return vandaag >= week.start && (!volgende || vandaag < volgende);
  });
  if (index === -1) return null;

  const dagenSindsMaandag = (vandaag.getTime() - weken[index].start.getTime()) / (1000 * 60 * 60 * 24);
  return index + dagenSindsMaandag / 7;
}

type HoverInfo = {
  campagne: Campagne;
  top: number;
  left: number;
};

/**
 * Jaaroverzicht van alle campagnes: per campagne één rij, met een gekleurde balk over de
 * weken waarin de campagne loopt. Zoomen verandert de kolombreedte; hoveren over een balk
 * toont periode, budget en uitgaven. Deelt de filterbalk (status/merk/ordersoort/
 * klantgroep) met het tabblad Campagnes via `useCampagneFilters()`.
 */
export default function CampagneTijdlijn() {
  const { campagnes, filtered } = useCampagneFilters();
  const asJaar = useMemo(() => bepaalAsJaar(campagnes), [campagnes]);
  const weken = useMemo(() => bouwWeken(asJaar), [asJaar]);
  const [kolombreedte, setKolombreedte] = useState(STANDAARD_KOLOMBREEDTE);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rijen = useMemo(
    () => filtered.map((campagne) => ({ campagne, balk: bepaalBalk(campagne, weken) })),
    [filtered, weken],
  );

  const vandaagPositie = useMemo(() => bepaalVandaagPositie(new Date(), weken), [weken]);

  if (campagnes.length === 0) {
    return <p className="text-sm text-ink-muted">Geen campagnes gevonden.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CampagneFilterBalk />

      <div className="rounded-card border border-line bg-card shadow-card">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <p className="text-sm text-ink-muted">Jaar {asJaar}, week 1 t/m 52</p>
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Inzoomen
            <input
              type="range"
              min={MIN_KOLOMBREEDTE}
              max={MAX_KOLOMBREEDTE}
              step={2}
              value={kolombreedte}
              onChange={(event) => setKolombreedte(Number(event.target.value))}
              className="h-1 w-32 accent-primary"
              aria-label="Zoomniveau tijdlijn"
            />
          </label>
        </div>

        {rijen.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">Geen campagnes voor deze filters.</p>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto" onScroll={() => setHover(null)}>
            <div className="relative" style={{ width: NAAMKOLOM + weken.length * kolombreedte }}>
              {/* Kop: weeknummers, verticaal gezet zodat ze passen bij smalle kolommen. */}
              <div
                className="sticky top-0 z-20 flex border-b border-line bg-card"
                style={{ height: KOPHOOGTE }}
              >
                <div
                  className="sticky left-0 z-30 shrink-0 border-r border-line bg-card"
                  style={{ width: NAAMKOLOM }}
                />
                {weken.map((week) => {
                  const huidigeWeek = vandaagPositie !== null && Math.floor(vandaagPositie) === week.nummer - 1;
                  return (
                    <div
                      key={week.nummer}
                      className="flex shrink-0 items-end justify-center border-r border-line-soft pb-1.5"
                      style={{ width: kolombreedte }}
                    >
                      <span
                        className={`text-[10px] leading-none ${huidigeWeek ? "font-sans-w7 text-primary" : "text-ink-faint"}`}
                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                      >
                        {week.nummer}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rijen: één per campagne, met de gekleurde balk over de looptijd. */}
              <div>
                {rijen.map(({ campagne, balk }) => (
                  <div
                    key={campagne.naam}
                    className="relative flex border-b border-line-soft last:border-b-0"
                    style={{ height: RIJHOOGTE }}
                  >
                    <div
                      className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-card px-3"
                      style={{ width: NAAMKOLOM }}
                    >
                      <span className="truncate text-sm text-ink" title={campagne.naam}>
                        {campagne.naam}
                      </span>
                    </div>

                    <div className="relative flex" style={{ width: weken.length * kolombreedte }}>
                      {weken.map((week, i) => (
                        <div
                          key={week.nummer}
                          className="shrink-0 border-r border-line-soft"
                          style={{
                            width: kolombreedte,
                            backgroundColor: i % 2 === 1 ? "var(--color-surface)" : undefined,
                          }}
                        />
                      ))}

                      {balk && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 rounded-pill bg-primary"
                          style={{
                            left: (balk.vanKolom - 1) * kolombreedte + 2,
                            width: (balk.totKolom - balk.vanKolom + 1) * kolombreedte - 4,
                            height: 14,
                          }}
                          onMouseEnter={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setHover({ campagne, top: rect.bottom + 8, left: rect.left });
                          }}
                          onMouseLeave={() => setHover(null)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Streep bij de huidige week, zodat je in één oogopslag ziet waar we nu zitten. */}
              {vandaagPositie !== null && (
                <div
                  className="pointer-events-none absolute z-10 w-px bg-primary/60"
                  style={{
                    left: NAAMKOLOM + vandaagPositie * kolombreedte,
                    top: KOPHOOGTE,
                    height: rijen.length * RIJHOOGTE,
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hover-popup via een portal naar <body>: net als bij Modal (zie CLAUDE.md) wint een
          eigen z-index niet van andere sticky cellen in dezelfde tabel — sticky elementen
          vormen elk hun eigen stacking context die alleen met siblings wordt vergeleken. */}
      {hover &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 w-56 rounded-panel border border-line bg-card p-3 shadow-dropdown"
            style={{ top: hover.top, left: hover.left }}
          >
            <p className="font-sans-w7 text-sm font-bold text-ink">{hover.campagne.naam}</p>
            <dl className="mt-2 space-y-1 text-xs text-ink-muted">
              <div className="flex justify-between gap-3">
                <dt>Periode</dt>
                <dd className="text-ink">
                  {formatDate(hover.campagne.startdatum)} – {formatDate(hover.campagne.einddatum)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Status</dt>
                <dd className="text-ink">{hover.campagne.status || "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Budget</dt>
                <dd className="text-ink">{formatCurrency(hover.campagne.budget)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Uitgaven</dt>
                <dd className="text-ink">{formatCurrency(hover.campagne.uitgaven)}</dd>
              </div>
            </dl>
          </div>,
          document.body,
        )}
    </div>
  );
}
