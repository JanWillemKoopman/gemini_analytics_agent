"use client";

import Avatar from "@/components/Avatar";
import { SOORTEN } from "@/lib/notities";
import {
  PUNTEN_PER_SOORT,
  bepaalMedailles,
  berekenPuntenstanden,
  legeStand,
  type Medaille,
  type PuntenPeriode,
} from "@/lib/punten";
import { formatNumber } from "@/lib/format";
import type { Bericht, Profiel } from "@/components/kennisacties/types";

type Props = {
  berichten: Bericht[];
  profielen: Profiel[];
  periode: PuntenPeriode;
  onPeriode: (periode: PuntenPeriode) => void;
};

const PERIODES: { waarde: PuntenPeriode; label: string }[] = [
  { waarde: 30, label: "30 dagen" },
  { waarde: 90, label: "90 dagen" },
  { waarde: null, label: "Alles" },
];

const MEDAILLE_STIJL: Record<Medaille, string> = {
  1: "bg-goud",
  2: "bg-zilver",
  3: "bg-brons",
};

const MEDAILLE_LABEL: Record<Medaille, string> = {
  1: "Eerste plaats",
  2: "Tweede plaats",
  3: "Derde plaats",
};

/**
 * Het medaillelabel dat over de rand van het avatar valt. Een klein, plat pilletje in
 * plaats van een glimmend medaille-icoon: de rij collega's moet rustig blijven, en het
 * cijfer is precies wat je wilt weten.
 */
function Medaillelabel({ plek }: { plek: Medaille }) {
  return (
    <span
      title={MEDAILLE_LABEL[plek]}
      className={`absolute -bottom-1 -right-1 rounded-pill px-1.5 py-px font-sans-w7 text-label font-bold tabular-nums text-on-medaille ring-2 ring-card ${MEDAILLE_STIJL[plek]}`}
    >
      <span className="sr-only">{MEDAILLE_LABEL[plek]}: </span>#{plek}
    </span>
  );
}

/** "+25%" / "−10%" / "nieuw" — nooit een oneindig percentage als er niets was om mee te vergelijken. */
function Verandering({ verandering, punten }: { verandering: number | null; punten: number }) {
  if (verandering === null) {
    return (
      <span className="text-xs text-ink-faint">
        {punten > 0 ? "nieuw" : "—"}
      </span>
    );
  }
  if (verandering === 0) return <span className="text-xs text-ink-faint">gelijk</span>;

  const omhoog = verandering > 0;
  return (
    <span className={`text-xs tabular-nums ${omhoog ? "text-positive" : "text-negative"}`}>
      {omhoog ? "+" : "−"}
      {Math.abs(verandering)}%
    </span>
  );
}

/**
 * De rij collega's boven aan "Kennis en acties": ieders profielfoto (of initialen) met
 * daaronder de punten die hij of zij in de gekozen periode heeft verdiend, en hoeveel dat
 * scheelt met de even lange periode daarvóór.
 *
 * Bewust géén ranglijst met een nummer één: de volgorde is alfabetisch en vast, zodat je
 * je collega altijd op dezelfde plek vindt. Iedereen met een account staat er, ook wie
 * nog niets heeft vastgelegd — die lege nul is de hele uitnodiging.
 */
export default function Scorebord({ berichten, profielen, periode, onPeriode }: Props) {
  const standen = berekenPuntenstanden(berichten, periode);
  const medailles = bepaalMedailles(standen);
  // De volgorde is en blijft alfabetisch — je vindt een collega op naam, niet op stand.
  // Wie goed bezig is, valt op aan de medaille, niet aan zijn plek in de rij.
  const opNaam = [...profielen].sort((a, b) =>
    (a.naam ?? "").localeCompare(b.naam ?? "", "nl", { sensitivity: "base" }),
  );
  const periodeLabel =
    periode === null ? "sinds het begin" : `in de laatste ${periode} dagen`;

  return (
    <section className="rounded-panel border border-line bg-card px-5 py-4 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans-w7 text-sm font-bold text-ink">Het team</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Punten {periodeLabel}
            {periode !== null && ", vergeleken met de periode daarvóór"}.
          </p>
        </div>

        <div className="flex items-center gap-0.5 rounded-control bg-surface p-0.5">
          {PERIODES.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onPeriode(p.waarde)}
              aria-pressed={periode === p.waarde}
              className={`rounded-control px-2.5 py-1 text-xs font-medium transition-colors duration-[var(--duur-snel)] ${
                periode === p.waarde
                  ? "bg-card text-ink shadow-card"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {profielen.length === 0 ? (
        <p className="mt-4 text-sm text-ink-faint">Nog geen collega&apos;s met een account.</p>
      ) : (
        // auto-fit i.p.v. een flexrij: de collega's verdelen zich zo over de volle
        // breedte van de kaart (en wrappen netjes zodra het er veel worden), in plaats
        // van links samen te klonteren met een leeg vlak ernaast.
        <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-y-5">
          {opNaam.map((profiel) => {
            const stand = standen[profiel.id] ?? legeStand(periode);
            return (
              <li key={profiel.id} className="flex flex-col items-center gap-1.5 text-center">
                <span className="relative inline-flex">
                  <Avatar naam={profiel.naam} avatarUrl={profiel.avatarUrl} size={48} />
                  {medailles[profiel.id] && <Medaillelabel plek={medailles[profiel.id]} />}
                </span>
                <span className="max-w-full truncate text-xs text-ink-muted" title={profiel.naam ?? ""}>
                  {profiel.naam || "Naamloos"}
                </span>
                <span
                  className={`font-sans-w7 text-cell font-bold tabular-nums ${
                    stand.punten > 0 ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {formatNumber(stand.punten)}
                </span>
                <Verandering verandering={stand.verandering} punten={stand.punten} />
              </li>
            );
          })}
        </ul>
      )}

      {/* De weging erbij, anders is een stand een cijfer zonder betekenis. */}
      <p className="mt-4 border-t border-line-soft pt-3 text-xs text-ink-faint">
        {SOORTEN.map((s) => `${s.label} ${PUNTEN_PER_SOORT[s.waarde]}`).join(" · ")} punten per bericht.
      </p>
    </section>
  );
}
