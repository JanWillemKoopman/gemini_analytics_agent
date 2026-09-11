"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface Melding {
  /** De hoofdregel, bijvoorbeeld "+20 punten". */
  titel: string;
  /** Eén regel context eronder; optioneel. */
  regel?: string;
}

type Props = {
  melding: Melding | null;
  onWeg: () => void;
  /** Hoe lang de melding blijft staan. */
  duurMs?: number;
};

/**
 * Korte bevestiging rechtsonder in beeld, bijvoorbeeld na het vastleggen van een
 * bericht ("+20 punten · hypothese").
 *
 * Waarom dit er is: punten die pas zichtbaar worden als je naar een ander tabblad gaat,
 * belonen niets. De bevestiging hoort te vallen op het moment van de handeling zelf.
 *
 * Net als Modal en Drawer via een portal naar <body>: de melding wordt geopend vanuit
 * een zijbalk die zelf net dichtgaat, en mag daar niet mee verdwijnen of onder
 * schuiven.
 */
export default function Toast({ melding, onWeg, duurMs = 4000 }: Props) {
  const [gemount, setGemount] = useState(false);

  useEffect(() => setGemount(true), []);

  useEffect(() => {
    if (!melding) return;
    const timer = setTimeout(onWeg, duurMs);
    return () => clearTimeout(timer);
  }, [melding, duurMs, onWeg]);

  if (!gemount || !melding) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // bottom-20: boven het ronde "+"-knopje rechtsonder, niet eroverheen.
      className="fixed bottom-20 right-6 z-50 max-w-xs rounded-card border border-line bg-card px-4 py-3 shadow-dropdown"
    >
      <p className="font-sans-w7 text-sm font-bold tabular-nums text-ink">{melding.titel}</p>
      {melding.regel && <p className="mt-0.5 text-xs text-ink-muted">{melding.regel}</p>}
    </div>,
    document.body,
  );
}
