"use client";

import { useMemo } from "react";
import Avatar from "@/components/Avatar";
import { MedaillePil } from "@/components/Medaille";
import { IconFlame } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { STREAK_BONUS, legeWeekpunten, type Weekpunten as WeekpuntenStand } from "@/lib/punten";
import { useTeamData, type Profiel } from "@/lib/teamData";
import { RESET_LABEL, tijdTotReset, weekLabel } from "@/lib/week";

/** Het verschil met vorige week in punten — in mensentaal, niet als kaal percentage. */
function Verschil({ nu, toen }: { nu: number; toen: number | null }) {
  if (toen === null) return <span className="text-xs text-ink-faint">—</span>;
  const delta = nu - toen;
  if (delta === 0) return <span className="text-xs text-ink-faint">gelijk</span>;
  return (
    <span className={`text-sm tabular-nums ${delta > 0 ? "text-positive" : "text-negative"}`}>
      {delta > 0 ? "+" : "−"}
      {formatNumber(Math.abs(delta))}
    </span>
  );
}

/** De lopende reeks: vier weken op rij is iets anders dan vier losse goede weken. */
function Reeks({ weken }: { weken: number }) {
  if (weken < 2) {
    return <span className="text-xs text-ink-faint">{weken === 1 ? "week 1" : "—"}</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-sm text-ink"
      title={`${weken} weken op rij iets vastgelegd`}
    >
      <IconFlame className="h-3.5 w-3.5 text-orange" />
      <span className="tabular-nums">{weken} weken</span>
    </span>
  );
}

/**
 * De weekstand: wie heeft er déze week wat vastgelegd, hoe verhoudt zich dat tot vorige
 * week, en wie staat er op #1, #2 en #3?
 *
 * Anders dan de rij collega's erboven staat deze tabel wél op punten gesorteerd. Dat is
 * precies waar deze sectie voor is: de week is de wedstrijd, de medailles vervallen bij
 * de volgende reset (maandag 11:59) en daarna begint iedereen weer op nul. De rij
 * erboven blijft het rustige overzicht waar je een collega op naam terugvindt.
 */
export default function Weekpunten() {
  const { seizoen, profielen, eigenId, nu } = useTeamData();
  const { huidige, vorige } = seizoen;

  const rijen = useMemo(() => {
    const lijst = profielen.map((profiel: Profiel) => ({
      profiel,
      stand: huidige.perGebruiker[profiel.id] ?? legeWeekpunten(),
      vorigeStand: vorige ? (vorige.perGebruiker[profiel.id] ?? legeWeekpunten()) : null,
      plek: huidige.medailles[profiel.id],
    }));
    // Hoogste stand eerst; bij gelijke stand op naam, zodat de volgorde niet per
    // render kan wisselen.
    lijst.sort(
      (a, b) =>
        b.stand.punten - a.stand.punten ||
        (a.profiel.naam ?? "").localeCompare(b.profiel.naam ?? "", "nl", { sensitivity: "base" }),
    );
    // De rang volgt dezelfde regel als de medailles: een gelijke stand deelt dezelfde
    // plek, dus twee keer #4 en dan #6.
    return lijst.map((rij) => ({
      ...rij,
      rang: lijst.filter((andere) => andere.stand.punten > rij.stand.punten).length + 1,
    }));
  }, [profielen, huidige, vorige]);

  const { dagen, uren } = tijdTotReset(nu);

  return (
    <section className="overflow-hidden rounded-panel border border-line bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div>
          <p className="font-sans-w7 text-sm font-bold text-ink">Deze week</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {weekLabel(huidige.venster)} · #1, #2 en #3 gaan {RESET_LABEL} weer op nul.
          </p>
        </div>
        <p className="text-xs text-ink-faint">
          Nog {dagen > 0 ? `${dagen} ${dagen === 1 ? "dag" : "dagen"}` : `${uren} uur`} te gaan ·{" "}
          <span className="tabular-nums">{formatNumber(huidige.teampunten)}</span> punten samen
        </p>
      </div>

      {profielen.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink-faint">Nog geen collega&apos;s met een account.</p>
      ) : (
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-surface-tint">
              {["#", "Collega", "Deze week", "Vorige week", "Verschil", "Reeks", "Berichten"].map(
                (kop, i) => (
                  <th
                    key={kop}
                    scope="col"
                    className={`label-theme border-y border-line px-3 py-2 text-label font-medium text-ink-faint ${
                      i === 0 ? "w-14 pl-5" : ""
                    } ${i > 1 ? "text-right" : ""} ${i === 6 ? "pr-5" : ""}`}
                  >
                    {kop}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rijen.map(({ profiel, stand, vorigeStand, plek, rang }) => {
              const jij = profiel.id === eigenId;
              return (
                <tr key={profiel.id}>
                  <td className="border-b border-line-soft py-2.5 pl-5 pr-3">
                    {plek ? (
                      <MedaillePil plek={plek} />
                    ) : (
                      <span className="text-sm tabular-nums text-ink-faint">
                        {stand.punten > 0 ? `#${rang}` : "—"}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-line-soft px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar naam={profiel.naam} avatarUrl={profiel.avatarUrl} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {profiel.naam || "Naamloos"}
                        </span>
                        {jij && <span className="block text-xs text-ink-faint">Jij</span>}
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-line-soft px-3 py-2.5 text-right">
                    <span
                      className={`font-sans-w7 text-cell font-bold tabular-nums ${
                        stand.punten > 0 ? "text-ink" : "text-ink-faint"
                      }`}
                    >
                      {formatNumber(stand.punten)}
                    </span>
                    {stand.bonus > 0 && (
                      <span className="block text-xs text-ink-faint">
                        {formatNumber(stand.basis)} + {formatNumber(stand.bonus)} streak
                      </span>
                    )}
                  </td>
                  <td className="border-b border-line-soft px-3 py-2.5 text-right text-sm tabular-nums text-ink-muted">
                    {vorigeStand ? formatNumber(vorigeStand.punten) : "—"}
                  </td>
                  <td className="border-b border-line-soft px-3 py-2.5 text-right">
                    <Verschil nu={stand.punten} toen={vorigeStand?.punten ?? null} />
                  </td>
                  <td className="border-b border-line-soft px-3 py-2.5 text-right">
                    <Reeks weken={stand.streak} />
                  </td>
                  <td className="border-b border-line-soft py-2.5 pl-3 pr-5 text-right text-sm tabular-nums text-ink-muted">
                    {stand.aantal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="px-5 py-3 text-xs text-ink-faint">
        Twee weken op rij iets vastleggen levert {STREAK_BONUS} bonuspunten op, en elke week
        daarna opnieuw. Een week overslaan zet de reeks terug op nul.
      </p>
    </section>
  );
}
