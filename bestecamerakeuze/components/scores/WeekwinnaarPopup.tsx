"use client";

import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { MEDAILLE_LABEL, Medaillelabel } from "@/components/Medaille";
import Modal from "@/components/Modal";
import { formatNumber } from "@/lib/format";
import { legeWeekpunten, teamWeekdoel, type Medaille } from "@/lib/punten";
import { useTeamData } from "@/lib/teamData";
import { RESET_TIJD, isWeekwinnaarVenster, weekLabel, weekSleutel } from "@/lib/week";

/** Onder deze sleutel onthoudt de browser welke week je hebt weggeklikt. */
const OPSLAG_SLEUTEL = "weekwinnaar-gezien";

function lees(sleutel: string): string | null {
  try {
    return window.localStorage.getItem(sleutel);
  } catch {
    // Privémodus of geblokkeerde opslag: dan tonen we de pop-up gewoon opnieuw.
    return null;
  }
}

function schrijf(sleutel: string, waarde: string): void {
  try {
    window.localStorage.setItem(sleutel, waarde);
  } catch {
    /* niets aan te doen — zie hierboven */
  }
}

/**
 * De weekwinnaar-pop-up: maandagochtend tussen 00:00 en 11:58 krijgt iedereen bij het
 * openen van het dashboard de uitslag van de week te zien die diezelfde ochtend om
 * 11:59 afsluit.
 *
 * Waarom juist dat venster: om 11:59 gaat de stand op nul (zie lib/week.ts), dus dit is
 * het laatste moment waarop de uitslag nog "van deze week" is — en tegelijk het moment
 * waarop het team zijn week begint. Na één keer wegklikken blijft hij die week weg; de
 * volgende maandag hoort bij een nieuwe weeksleutel en verschijnt hij dus opnieuw.
 *
 * Hij hangt in AppShell en niet op het scoretabblad: de uitslag hoort je te vinden waar
 * je toch al bent, ook als je die ochtend meteen naar de campagnes doorklikt.
 */
export default function WeekwinnaarPopup() {
  const { ingelogd, seizoen, profielPerId, profielen, eigenId, nu } = useTeamData();
  const { huidige } = seizoen;

  const sleutel = `${OPSLAG_SLEUTEL}:${eigenId ?? "gast"}`;
  const week = weekSleutel(huidige.venster);
  const [weggeklikt, setWeggeklikt] = useState<string | null>(null);
  const [gelezen, setGelezen] = useState(false);

  useEffect(() => {
    setWeggeklikt(lees(sleutel));
    setGelezen(true);
  }, [sleutel]);

  const podium = useMemo(() => {
    return Object.entries(huidige.medailles)
      .map(([id, plek]) => ({
        id,
        plek: plek as Medaille,
        naam: profielPerId[id]?.naam ?? null,
        avatarUrl: profielPerId[id]?.avatarUrl ?? null,
        punten: (huidige.perGebruiker[id] ?? legeWeekpunten()).punten,
      }))
      .sort((a, b) => a.plek - b.plek || b.punten - a.punten);
  }, [huidige, profielPerId]);

  // Niets vastgelegd? Dan valt er ook niets te vieren, en houden we onze mond.
  const tonen =
    ingelogd && gelezen && weggeklikt !== week && isWeekwinnaarVenster(nu) && podium.length > 0;
  if (!tonen) return null;

  const eigen = eigenId ? (huidige.perGebruiker[eigenId] ?? legeWeekpunten()) : null;
  const doel = teamWeekdoel(profielen.length);

  function sluiten() {
    schrijf(sleutel, week);
    setWeggeklikt(week);
  }

  return (
    <Modal title="De weekstand" onClose={sluiten}>
      <p className="text-xs text-ink-faint">{weekLabel(huidige.venster)}</p>
      <p className="mt-1 font-sans-w7 text-sm font-bold text-ink">
        {podium.filter((p) => p.plek === 1).length > 1
          ? "Gedeelde eerste plaats deze week"
          : `${podium[0].naam || "Naamloos"} wint deze week`}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {podium.map((plaats) => (
          <li
            key={plaats.id}
            className={`flex items-center gap-3 rounded-card border px-3 py-2 ${
              plaats.id === eigenId ? "border-primary bg-primary-light" : "border-line"
            }`}
          >
            <span className="relative inline-flex">
              <Avatar naam={plaats.naam} avatarUrl={plaats.avatarUrl} size={36} />
              <Medaillelabel plek={plaats.plek} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">
                {plaats.naam || "Naamloos"}
              </span>
              <span className="block text-xs text-ink-faint">{MEDAILLE_LABEL[plaats.plek]}</span>
            </span>
            <span className="font-sans-w7 text-cell font-bold tabular-nums text-ink">
              {formatNumber(plaats.punten)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-line-soft pt-3 text-sm text-ink-muted">
        <p>
          Samen {formatNumber(huidige.teampunten)} punten (doel: {formatNumber(doel)}) —{" "}
          {huidige.teampunten >= doel ? (
            <span className="text-positive">teamdoel gehaald.</span>
          ) : (
            <>{formatNumber(doel - huidige.teampunten)} te kort.</>
          )}
        </p>
        {eigen && (
          <p className="mt-1">
            Jij legde {eigen.aantal} {eigen.aantal === 1 ? "bericht" : "berichten"} vast, goed voor{" "}
            {formatNumber(eigen.punten)} punten
            {eigen.streak >= 2 ? ` en een reeks van ${eigen.streak} weken` : ""}.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">De stand gaat vandaag om {RESET_TIJD} op nul.</p>
        <button
          type="button"
          onClick={sluiten}
          className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Aan de slag
        </button>
      </div>
    </Modal>
  );
}
