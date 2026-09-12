"use client";

import ProgressBar from "@/components/ProgressBar";
import { IconTarget } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { WEEKDOEL_PER_COLLEGA, teamWeekdoel } from "@/lib/punten";
import { useTeamData } from "@/lib/teamData";
import { RESET_LABEL, tijdTotReset, weekLabel } from "@/lib/week";

/** "nog 3 dagen" / "nog 4 uur" — hoe lang deze week nog loopt. */
function resterend(nu: Date): string {
  const { dagen, uren } = tijdTotReset(nu);
  if (dagen > 0) return `nog ${dagen} ${dagen === 1 ? "dag" : "dagen"}`;
  if (uren > 0) return `nog ${uren} ${uren === 1 ? "uur" : "uur"}`;
  return "sluit zo";
}

/**
 * Het teamdoel, bovenaan het scoretabblad: hoeveel punten heeft het team déze week
 * samen vastgelegd, en hoeveel had het zich voorgenomen?
 *
 * Waarom dit boven de individuele stand staat: het weekoverleg is een teamritueel. Een
 * ranglijst maakt zichtbaar wie bijdraagt, maar alleen een gezamenlijk doel maakt van
 * een achterblijvende week een probleem van het team in plaats van van één collega. Het
 * doel schaalt mee met het aantal collega's (zie `teamWeekdoel`), zodat het klopt blijft
 * als er iemand bij komt.
 */
export default function Teamdoel() {
  const { seizoen, profielen, nu } = useTeamData();
  const { huidige, vorige } = seizoen;

  const doel = teamWeekdoel(profielen.length);
  const punten = huidige.teampunten;
  const percent = doel > 0 ? (punten / doel) * 100 : 0;
  const gehaald = punten >= doel;
  const verschil = vorige ? punten - vorige.teampunten : null;

  return (
    <section className="kaart-omlijst rounded-panel border border-line bg-card px-5 py-4 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface text-ink-muted">
            <IconTarget className="h-4 w-4" />
          </span>
          <div>
            <p className="font-sans-w7 text-sm font-bold text-ink">Teamdoel deze week</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {WEEKDOEL_PER_COLLEGA} punten per collega — één hypothese of drie observaties
              per persoon.
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-ink-faint">{weekLabel(huidige.venster)}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Reset {RESET_LABEL} · {resterend(nu)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <p className="font-sans-w7 text-title font-bold tabular-nums text-ink">
          {formatNumber(punten)}
          <span className="text-cell font-medium text-ink-faint"> / {formatNumber(doel)} punten</span>
        </p>
        <p className="text-sm text-ink-muted">
          {gehaald ? (
            <span className="text-positive">Doel gehaald.</span>
          ) : (
            <>Nog {formatNumber(doel - punten)} punten te gaan.</>
          )}{" "}
          {verschil === null ? (
            "Eerste week die we bijhouden."
          ) : verschil === 0 ? (
            "Precies evenveel als vorige week."
          ) : (
            <>
              {formatNumber(Math.abs(verschil))} {verschil > 0 ? "meer" : "minder"} dan vorige week.
            </>
          )}
        </p>
      </div>

      <div className="mt-2">
        <ProgressBar percent={percent} className="h-2 max-w-none" />
      </div>

      <p className="mt-3 border-t border-line-soft pt-3 text-xs text-ink-faint">
        {huidige.teamaantal} {huidige.teamaantal === 1 ? "bericht" : "berichten"} deze week
        vastgelegd door {Object.keys(huidige.perGebruiker).length} van de {profielen.length}{" "}
        collega&apos;s.
      </p>
    </section>
  );
}
