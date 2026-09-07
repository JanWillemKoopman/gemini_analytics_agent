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
const MAANDRIJHOOGTE = 22;
const WEEKRIJHOOGTE = 34;
const KOPHOOGTE = MAANDRIJHOOGTE + WEEKRIJHOOGTE;
/** Vanaf hoeveel pixels breedte een balk zijn campagnenaam intern nog leesbaar toont. */
const MIN_BREEDTE_VOOR_LABEL = 64;
/** Een lopende campagne geldt als "loopt bijna af" binnen dit aantal dagen tot de einddatum. */
const BIJNA_AF_DAGEN = 7;

const MAAND_NAMEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

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

type MaandBlok = {
  sleutel: string;
  label: string;
  vanKolom: number;
  aantalWeken: number;
};

/**
 * Groepeert de weken in aaneengesloten maandblokken (op basis van de donderdag in elke
 * week, zoals ook de ISO-weeknummering zelf werkt) — dat bepaalt zowel de maandlabels
 * boven de weeknummers als de kolommen waarop we de maandgrens en de zebra-banden tekenen.
 */
function bepaalMaandBlokken(weken: Week[]): MaandBlok[] {
  const blokken: MaandBlok[] = [];
  weken.forEach((week, i) => {
    const midden = new Date(week.start);
    midden.setUTCDate(midden.getUTCDate() + 3);
    const sleutel = `${midden.getUTCFullYear()}-${midden.getUTCMonth()}`;
    const laatste = blokken[blokken.length - 1];
    if (laatste && laatste.sleutel === sleutel) {
      laatste.aantalWeken += 1;
    } else {
      blokken.push({ sleutel, label: MAAND_NAMEN[midden.getUTCMonth()], vanKolom: i, aantalWeken: 1 });
    }
  });
  return blokken;
}

type Balk = {
  campagne: Campagne;
  vanKolom: number;
  totKolom: number;
  status: StatusKleur;
};

type StatusKleur = "actief" | "bijna-af" | "gepland" | "afgelopen";

/** Leest de balkkleur af de looptijd t.o.v. vandaag — niet uit de ruwe sheet-statustekst,
 *  zodat "loopt bijna af" en "gepland" ook zonder handmatige statuswissel zichtbaar zijn. */
function bepaalStatusKleur(start: Date, eind: Date, vandaag: Date): StatusKleur {
  if (eind < vandaag) return "afgelopen";
  if (start > vandaag) return "gepland";
  const dagenTotEind = (eind.getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24);
  return dagenTotEind <= BIJNA_AF_DAGEN ? "bijna-af" : "actief";
}

const STATUS_STYLE: Record<StatusKleur, { label: string; balk: string; tekst: string; dot: string }> = {
  actief: { label: "Actief", balk: "bg-open", tekst: "text-on-primary", dot: "bg-open" },
  "bijna-af": { label: "Loopt bijna af", balk: "bg-orange", tekst: "text-on-primary", dot: "bg-orange" },
  gepland: {
    label: "Gepland",
    balk: "border-2 border-primary bg-card",
    tekst: "text-primary",
    dot: "border-2 border-primary bg-card",
  },
  afgelopen: { label: "Afgelopen", balk: "bg-closed", tekst: "text-on-primary", dot: "bg-closed" },
};

/** Zet start-/einddatum om naar een kolomrange binnen 1..52; valt de periode buiten het jaar dan geen balk. */
function bepaalBalk(campagne: Campagne, weken: Week[], vandaag: Date): Balk | null {
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
  return {
    campagne,
    vanKolom,
    totKolom: Math.max(vanKolom, totKolom),
    status: bepaalStatusKleur(start, eind, vandaag),
  };
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
  status: StatusKleur;
  top: number;
  left: number;
};

/**
 * Jaaroverzicht van alle campagnes: per campagne één rij, met een gekleurde balk over de
 * weken waarin de campagne loopt. De balkkleur volgt de looptijd t.o.v. vandaag (gepland /
 * actief / loopt bijna af / afgelopen, zie STATUS_STYLE en de legenda in de kopregel).
 * Boven de weeknummers staat een maandenrij met zachte zebra-banden en een dikkere
 * kolomrand per maandgrens, zodat de jaarplanning ook op maandniveau leesbaar blijft
 * terwijl de as zelf per week ingedeeld blijft. Zoomen verandert de kolombreedte; hoveren
 * over een balk toont periode, budget en uitgaven. Deelt de filterbalk (status/merk/
 * ordersoort/klantgroep) met het tabblad Campagnes via `useCampagneFilters()`.
 */
export default function CampagneTijdlijn() {
  const { campagnes, filtered } = useCampagneFilters();
  const asJaar = useMemo(() => bepaalAsJaar(campagnes), [campagnes]);
  const weken = useMemo(() => bouwWeken(asJaar), [asJaar]);
  const maandBlokken = useMemo(() => bepaalMaandBlokken(weken), [weken]);
  const [kolombreedte, setKolombreedte] = useState(STANDAARD_KOLOMBREEDTE);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const vandaag = useMemo(() => new Date(), []);

  const rijen = useMemo(
    () => filtered.map((campagne) => ({ campagne, balk: bepaalBalk(campagne, weken, vandaag) })),
    [filtered, weken, vandaag],
  );

  const vandaagPositie = useMemo(() => bepaalVandaagPositie(vandaag, weken), [vandaag, weken]);

  /** Even/oneven maandindex per weekkolom — bepaalt de zebra-achtergrond van die kolom. */
  const weekMaandPariteit = useMemo(() => {
    const rij: number[] = [];
    maandBlokken.forEach((blok, blokIndex) => {
      for (let i = 0; i < blok.aantalWeken; i += 1) rij.push(blokIndex % 2);
    });
    return rij;
  }, [maandBlokken]);

  const maandGrensKolommen = useMemo(
    () => new Set(maandBlokken.slice(1).map((blok) => blok.vanKolom)),
    [maandBlokken],
  );

  if (campagnes.length === 0) {
    return <p className="text-sm text-ink-muted">Geen campagnes gevonden.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <CampagneFilterBalk />

      <div className="rounded-card border border-line bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-sm text-ink-muted">Jaar {asJaar}, week 1 t/m 52</p>
          <div className="flex items-center gap-5">
            <ul className="flex items-center gap-3.5 text-xs text-ink-muted">
              {(Object.keys(STATUS_STYLE) as StatusKleur[]).map((status) => (
                <li key={status} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[status].dot}`} />
                  {STATUS_STYLE[status].label}
                </li>
              ))}
            </ul>
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
        </div>

        {rijen.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">Geen campagnes voor deze filters.</p>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto" onScroll={() => setHover(null)}>
            <div className="relative" style={{ width: NAAMKOLOM + weken.length * kolombreedte }}>
              {/* Kop: maandenrij (oriëntatie) boven de weeknummers (precisie). */}
              <div className="sticky top-0 z-20 flex flex-col border-b border-line bg-card">
                <div className="flex" style={{ height: MAANDRIJHOOGTE }}>
                  <div className="sticky left-0 z-30 shrink-0 border-r border-line bg-card" style={{ width: NAAMKOLOM }} />
                  {maandBlokken.map((blok, blokIndex) => (
                    <div
                      key={blok.sleutel}
                      className={`flex shrink-0 items-center justify-center border-r border-line-soft text-[11px] uppercase tracking-wide text-ink-faint ${
                        blokIndex % 2 === 1 ? "bg-surface" : ""
                      } ${blokIndex > 0 ? "border-l border-line" : ""}`}
                      style={{ width: blok.aantalWeken * kolombreedte }}
                    >
                      {blok.label}
                    </div>
                  ))}
                </div>
                <div className="flex" style={{ height: WEEKRIJHOOGTE }}>
                  <div className="sticky left-0 z-30 shrink-0 border-r border-line bg-card" style={{ width: NAAMKOLOM }} />
                  {weken.map((week, i) => {
                    const huidigeWeek = vandaagPositie !== null && Math.floor(vandaagPositie) === week.nummer - 1;
                    return (
                      <div
                        key={week.nummer}
                        className={`flex shrink-0 items-end justify-center border-r border-line-soft pb-1.5 ${
                          weekMaandPariteit[i] === 1 ? "bg-surface" : ""
                        } ${maandGrensKolommen.has(i) ? "border-l border-line" : ""}`}
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
              </div>

              {/* Rijen: één per campagne, met de gekleurde balk over de looptijd. */}
              <div>
                {rijen.map(({ campagne, balk }) => {
                  const stijl = balk ? STATUS_STYLE[balk.status] : null;
                  const breedte = balk ? (balk.totKolom - balk.vanKolom + 1) * kolombreedte - 4 : 0;
                  return (
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
                            className={`shrink-0 border-r border-line-soft ${
                              weekMaandPariteit[i] === 1 ? "bg-surface" : ""
                            } ${maandGrensKolommen.has(i) ? "border-l border-line" : ""}`}
                            style={{ width: kolombreedte }}
                          />
                        ))}

                        {balk && stijl && (
                          <div
                            className={`absolute top-1/2 flex -translate-y-1/2 items-center overflow-hidden rounded-pill shadow-card ${stijl.balk}`}
                            style={{
                              left: (balk.vanKolom - 1) * kolombreedte + 2,
                              width: breedte,
                              height: 16,
                            }}
                            onMouseEnter={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setHover({ campagne, status: balk.status, top: rect.bottom + 8, left: rect.left });
                            }}
                            onMouseLeave={() => setHover(null)}
                          >
                            {breedte >= MIN_BREEDTE_VOOR_LABEL && (
                              <span className={`truncate px-2 text-[11px] font-medium leading-none ${stijl.tekst}`}>
                                {campagne.naam}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                <dd className="flex items-center gap-1.5 text-ink">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLE[hover.status].dot}`} />
                  {STATUS_STYLE[hover.status].label}
                </dd>
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
