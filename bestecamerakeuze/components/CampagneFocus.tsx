"use client";

import { useEffect } from "react";
import NotitieLijst from "@/components/notities/NotitieLijst";
import StatusIndicator from "@/components/StatusIndicator";
import { getBrandLogo } from "@/components/brandLogos";
import { IconClose } from "@/components/icons";
import { formatDate, isCampagneLive } from "@/lib/format";
import type { Campagne } from "@/lib/sheet";

/**
 * Focusmodus: het logboek van één campagne, groot genoeg om er meteen in te werken.
 *
 * De cijfers en kenmerken staan al in de tabel erboven (die blijft zichtbaar, alleen
 * gedempt) — dit paneel dupliceert ze bewust niet meer. Zodra iemand op een
 * campagnenaam klikt, treedt de rest terug en krijgt het logboek de volle breedte,
 * zodat wat er in het overleg besproken wordt daar meteen bij kan zonder een pop-up
 * te openen.
 */

type Props = {
  campagne: Campagne;
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
  onSluit: () => void;
};

export default function CampagneFocus({
  campagne,
  notitiesBeschikbaar,
  ingelogd,
  onSluit,
}: Props) {
  // Escape sluit de focus — dezelfde reflex als bij een pop-up.
  useEffect(() => {
    function bijToets(event: KeyboardEvent) {
      if (event.key === "Escape") onSluit();
    }
    document.addEventListener("keydown", bijToets);
    return () => document.removeEventListener("keydown", bijToets);
  }, [onSluit]);

  const BrandLogo = campagne.merk ? getBrandLogo(campagne.merk) : null;

  return (
    <section
      aria-label={`Focus op ${campagne.naam}`}
      className="rounded-panel border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {BrandLogo && (
            <BrandLogo role="img" aria-label={campagne.merk} className="h-5 w-5 shrink-0 text-ink-muted" />
          )}
          <div className="min-w-0">
            <h2 className="titel-theme truncate font-sans-w7 text-title font-bold text-ink">
              {campagne.naam}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
              <StatusIndicator live={isCampagneLive(campagne)} />
              <span>
                {formatDate(campagne.startdatum)} — {formatDate(campagne.einddatum)}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSluit}
          className="flex items-center gap-1.5 rounded-button border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary hover:text-ink"
        >
          <IconClose className="h-3.5 w-3.5" />
          Focus verlaten
        </button>
      </header>

      <div className="mt-5 border-t border-line-soft pt-5">
        <p className="label-theme mb-3 text-label text-ink-faint">Logboek</p>
        {notitiesBeschikbaar ? (
          <NotitieLijst campagne={campagne} ingelogd={ingelogd} />
        ) : (
          <p className="text-sm text-ink-faint">
            Het logboek heeft een database nodig; die is hier niet geconfigureerd.
          </p>
        )}
      </div>
    </section>
  );
}
