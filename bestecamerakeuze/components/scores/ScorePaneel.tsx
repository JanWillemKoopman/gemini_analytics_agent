"use client";

import Inlogprompt from "@/components/Inlogprompt";
import Prijzenkast from "@/components/scores/Prijzenkast";
import TeamScorebord from "@/components/scores/TeamScorebord";
import Teamdoel from "@/components/scores/Teamdoel";
import Weekpunten from "@/components/scores/Weekpunten";
import { useTeamData } from "@/lib/teamData";

/**
 * Het tabblad "Scores": alles rondom de puntentelling, van boven naar beneden in de
 * volgorde waarin je het wilt lezen.
 *
 *  1. Het gezamenlijke teamdoel van deze week — samen vóór individueel.
 *  2. De rij collega's met hun punten over 30/90 dagen of alles.
 *  3. De weekstand met #1/#2/#3, het verschil met vorige week en de reeksen.
 *  4. De totaalstand zonder einddatum, met de gewonnen weken erbij.
 *
 * De inhoud van wat er vastgelegd is (de berichten zelf en de acties) staat bewust op
 * een eigen tabblad: hier gaat het over het ritme, daar over de inhoud.
 */
export default function ScorePaneel() {
  const { ingelogd, laden, fout } = useTeamData();

  if (!ingelogd) {
    return <Inlogprompt tekst="Log in om de stand van het team te zien en zelf punten te verdienen." />;
  }

  if (laden) {
    return (
      <div className="rounded-panel border border-line bg-card px-5 py-8 text-sm text-ink-faint shadow-subtle">
        Laden…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fout && (
        <p className="rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">
          {fout}
        </p>
      )}
      <Teamdoel />
      <TeamScorebord />
      <Weekpunten />
      <Prijzenkast />
    </div>
  );
}
