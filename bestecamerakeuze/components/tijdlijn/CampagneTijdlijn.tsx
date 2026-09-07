"use client";

import { useMemo, useState } from "react";
import type { Campagne } from "@/lib/sheet";
import { formatCurrency, formatDate } from "@/lib/format";

type Props = {
  campagnes: Campagne[];
};

type Week = {
  nummer: number;
  /** Maandag van deze ISO-week — bepaalt in welke kolom een campagnedatum valt. */
  start: Date;
};

const MIN_KOLOMBREEDTE = 14;
const MAX_KOLOMBREEDTE = 44;
const STANDAARD_KOLOMBREEDTE = 24;

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

/**
 * Jaaroverzicht van alle campagnes: per campagne één rij, met een gekleurde balk over de
 * weken waarin de campagne loopt. Zoomen verandert de kolombreedte; hoveren over een balk
 * toont periode, budget en uitgaven. Verder staat er bewust niets op deze pagina.
 */
export default function CampagneTijdlijn({ campagnes }: Props) {
  const asJaar = useMemo(() => bepaalAsJaar(campagnes), [campagnes]);
  const weken = useMemo(() => bouwWeken(asJaar), [asJaar]);
  const [kolombreedte, setKolombreedte] = useState(STANDAARD_KOLOMBREEDTE);

  const rijen = useMemo(
    () => campagnes.map((campagne) => ({ campagne, balk: bepaalBalk(campagne, weken) })),
    [campagnes, weken],
  );

  const NAAMKOLOM = 220;
  const rijhoogte = 40;

  if (campagnes.length === 0) {
    return <p className="text-sm text-ink-muted">Geen campagnes gevonden.</p>;
  }

  return (
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

      <div className="overflow-x-auto">
        <div style={{ width: NAAMKOLOM + weken.length * kolombreedte }}>
          {/* Kop: weeknummers, verticaal gezet zodat ze passen bij smalle kolommen. */}
          <div
            className="sticky top-0 z-10 flex border-b border-line bg-card"
            style={{ height: 56 }}
          >
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-line bg-card"
              style={{ width: NAAMKOLOM }}
            />
            {weken.map((week) => (
              <div
                key={week.nummer}
                className="flex shrink-0 items-end justify-center border-r border-line-soft pb-1.5"
                style={{ width: kolombreedte }}
              >
                <span
                  className="text-[10px] leading-none text-ink-faint"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {week.nummer}
                </span>
              </div>
            ))}
          </div>

          {/* Rijen: één per campagne, met de gekleurde balk over de looptijd. */}
          <div>
            {rijen.map(({ campagne, balk }) => (
              <div
                key={campagne.naam}
                className="relative flex border-b border-line-soft last:border-b-0"
                style={{ height: rijhoogte }}
              >
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center border-r border-line bg-card px-3"
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
                      style={{ width: kolombreedte, backgroundColor: i % 2 === 1 ? "var(--color-surface)" : undefined }}
                    />
                  ))}

                  {balk && (
                    <div
                      className="group absolute top-1/2 z-10 -translate-y-1/2 rounded-pill bg-primary"
                      style={{
                        left: (balk.vanKolom - 1) * kolombreedte + 2,
                        width: (balk.totKolom - balk.vanKolom + 1) * kolombreedte - 4,
                        height: 14,
                      }}
                    >
                      <div className="pointer-events-none absolute top-full left-0 z-30 mt-2 hidden w-56 rounded-panel border border-line bg-card p-3 shadow-dropdown group-hover:block">
                        <p className="font-sans-w7 text-sm font-bold text-ink">{campagne.naam}</p>
                        <dl className="mt-2 space-y-1 text-xs text-ink-muted">
                          <div className="flex justify-between gap-3">
                            <dt>Periode</dt>
                            <dd className="text-ink">
                              {formatDate(campagne.startdatum)} – {formatDate(campagne.einddatum)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt>Status</dt>
                            <dd className="text-ink">{campagne.status || "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt>Budget</dt>
                            <dd className="text-ink">{formatCurrency(campagne.budget)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt>Uitgaven</dt>
                            <dd className="text-ink">{formatCurrency(campagne.uitgaven)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
