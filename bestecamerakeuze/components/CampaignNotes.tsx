"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import NotitieLijst from "@/components/notities/NotitieLijst";
import { IconNotes } from "@/components/icons";
import type { Campagne } from "@/lib/sheet";

/**
 * Subtiel knopje in de campagnekop dat het logboek van die campagne opent: observaties,
 * hypotheses, besluiten en acties, met daaronder het cijfer dat erdoor moest veranderen
 * (zie NotitieLijst). Wordt alleen gerenderd wanneer Supabase geconfigureerd is (zie
 * CampaignHeader.tsx) — zonder database is er niets om in op te slaan.
 */
export default function CampaignNotes({
  campagne,
  ingelogd,
}: {
  campagne: Campagne;
  ingelogd: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Logboek"
        aria-label={`Logboek voor ${campagne.naam}`}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition-colors duration-150 hover:bg-surface hover:text-ink-muted"
      >
        <IconNotes className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Modal title={`Logboek — ${campagne.naam}`} onClose={() => setOpen(false)}>
          <NotitieLijst campagne={campagne} ingelogd={ingelogd} />
        </Modal>
      )}
    </>
  );
}
