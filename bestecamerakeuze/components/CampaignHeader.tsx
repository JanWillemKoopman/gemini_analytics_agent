"use client";

import { useState } from "react";
import type { Campagne } from "@/lib/sheet";
import StatusIndicator from "@/components/StatusIndicator";
import { getBrandLogo } from "@/components/brandLogos";
import CampaignNotes from "@/components/CampaignNotes";
import Drawer from "@/components/Drawer";
import NotitieLijst from "@/components/notities/NotitieLijst";
import { isCampagneLive } from "@/lib/format";

type Props = {
  campagne: Campagne;
  /** Alleen tonen als er ook echt iets is om het logboek in op te slaan. */
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
};

/**
 * Kolomkop van één campagne: naam als primaire informatie, merk + status als metadata.
 *
 * De naam is tegelijk de knop naar het logboek: één klik laat de zijbalk (`Drawer.tsx`)
 * van rechts uitklappen, met `NotitieLijst` erin. Hetzelfde knopje staat er ook nog als
 * subtiel icoontje (`CampaignNotes.tsx`) naast de naam, voor wie dat sneller vindt —
 * beide openen exact dezelfde zijbalk, vandaar dat de open-state hier op één plek leeft.
 */
export default function CampaignHeader({ campagne, notitiesBeschikbaar, ingelogd }: Props) {
  const [open, setOpen] = useState(false);
  const BrandLogo = campagne.merk ? getBrandLogo(campagne.merk) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-start justify-between gap-1.5">
        {notitiesBeschikbaar ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Logboek"
            className="block min-w-0 truncate text-left text-cell font-semibold text-ink transition-colors hover:text-primary"
          >
            {campagne.naam}
          </button>
        ) : (
          <span className="block min-w-0 truncate text-cell font-semibold text-ink">{campagne.naam}</span>
        )}
        {notitiesBeschikbaar && <CampaignNotes campagne={campagne} onOpen={() => setOpen(true)} />}
      </div>
      <span className="flex min-w-0 items-center gap-1.5">
        {campagne.merk &&
          (BrandLogo ? (
            <BrandLogo role="img" aria-label={campagne.merk} className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          ) : (
            <span className="min-w-0 truncate text-xs text-ink-faint">{campagne.merk}</span>
          ))}
        <StatusIndicator live={isCampagneLive(campagne)} />
      </span>

      {open && notitiesBeschikbaar && (
        <Drawer title={`Logboek — ${campagne.naam}`} onClose={() => setOpen(false)}>
          <NotitieLijst campagne={campagne} ingelogd={ingelogd} />
        </Drawer>
      )}
    </div>
  );
}
