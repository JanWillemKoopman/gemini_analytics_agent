"use client";

import { useMemo } from "react";
import Avatar from "@/components/Avatar";
import { MedaillePil } from "@/components/Medaille";
import { IconTrophy } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { legeTotaalstand } from "@/lib/punten";
import { useTeamData, type Profiel } from "@/lib/teamData";

/**
 * De totaalstand: alles bij elkaar sinds het allereerste bericht, zonder einddatum.
 *
 * De weekstand hierboven begint elke maandag opnieuw — daar hoort tegenover te staan dat
 * wat je hebt opgebouwd nooit meer weggaat. Naast de punten staat daarom de prijzenkast:
 * hoe vaak stond deze collega op #1, #2 of #3 in een week die is afgelopen? De medailles
 * van de lopende week staan er bewust nog niet bij; die zijn pas verdiend als de week
 * maandag om 11:59 dichtklapt.
 */
export default function Prijzenkast() {
  const { seizoen, profielen, eigenId } = useTeamData();

  const rijen = useMemo(() => {
    const lijst = profielen.map((profiel: Profiel) => ({
      profiel,
      totaal: seizoen.totalen[profiel.id] ?? legeTotaalstand(),
    }));
    return lijst.sort(
      (a, b) =>
        b.totaal.punten - a.totaal.punten ||
        b.totaal.prijzen - a.totaal.prijzen ||
        (a.profiel.naam ?? "").localeCompare(b.profiel.naam ?? "", "nl", { sensitivity: "base" }),
    );
  }, [profielen, seizoen]);

  const weken = seizoen.weken.filter((week) => week.afgelopen).length;

  return (
    <section className="kaart-omlijst overflow-hidden rounded-panel border border-line bg-card shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface text-ink-muted">
            <IconTrophy className="h-4 w-4" />
          </span>
          <div>
            <p className="font-sans-w7 text-sm font-bold text-ink">Totaalstand</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              Alles sinds het begin, zonder einddatum — punten én gewonnen weken.
            </p>
          </div>
        </div>
        <p className="text-xs text-ink-faint">
          {weken} {weken === 1 ? "week" : "weken"} afgerond
        </p>
      </div>

      {profielen.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink-faint">Nog geen collega&apos;s met een account.</p>
      ) : (
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr className="bg-surface-tint">
              {["Collega", "Punten", "Waarvan streak", "Berichten", "Langste reeks", "Prijzen"].map(
                (kop, i) => (
                  <th
                    key={kop}
                    scope="col"
                    className={`label-theme border-y border-line px-3 py-2 text-label font-medium text-ink-faint ${
                      i === 0 ? "pl-5" : "text-right"
                    } ${i === 5 ? "pr-5" : ""}`}
                  >
                    {kop}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rijen.map(({ profiel, totaal }) => (
              <tr key={profiel.id}>
                <td className="border-b border-line-soft py-2.5 pl-5 pr-3">
                  <span className="flex items-center gap-2.5">
                    <Avatar naam={profiel.naam} avatarUrl={profiel.avatarUrl} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {profiel.naam || "Naamloos"}
                      </span>
                      {profiel.id === eigenId && (
                        <span className="block text-xs text-ink-faint">Jij</span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="border-b border-line-soft px-3 py-2.5 text-right">
                  <span
                    className={`font-sans-w7 text-cell font-bold tabular-nums ${
                      totaal.punten > 0 ? "text-ink" : "text-ink-faint"
                    }`}
                  >
                    {formatNumber(totaal.punten)}
                  </span>
                </td>
                <td className="border-b border-line-soft px-3 py-2.5 text-right text-sm tabular-nums text-ink-muted">
                  {totaal.bonus > 0 ? formatNumber(totaal.bonus) : "—"}
                </td>
                <td className="border-b border-line-soft px-3 py-2.5 text-right text-sm tabular-nums text-ink-muted">
                  {totaal.aantal}
                </td>
                <td className="border-b border-line-soft px-3 py-2.5 text-right text-sm tabular-nums text-ink-muted">
                  {totaal.langsteStreak > 0
                    ? `${totaal.langsteStreak} ${totaal.langsteStreak === 1 ? "week" : "weken"}`
                    : "—"}
                </td>
                <td className="border-b border-line-soft py-2.5 pl-3 pr-5">
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    {totaal.goud > 0 && <MedaillePil plek={1} aantal={totaal.goud} />}
                    {totaal.zilver > 0 && <MedaillePil plek={2} aantal={totaal.zilver} />}
                    {totaal.brons > 0 && <MedaillePil plek={3} aantal={totaal.brons} />}
                    {totaal.prijzen === 0 && <span className="text-sm text-ink-faint">—</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="px-5 py-3 text-xs text-ink-faint">
        Een prijs wordt toegekend zodra een week is afgelopen; een gelijke stand deelt dezelfde
        plek. Punten uit de lopende week tellen hier al mee, de medaille van deze week nog niet.
      </p>
    </section>
  );
}
