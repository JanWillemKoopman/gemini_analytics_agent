"use client";

import { useState } from "react";
import { IconPlus } from "@/components/icons";
import NieuweCampagneModal from "@/components/NieuweCampagneModal";

type Props = {
  ingelogd: boolean;
};

/**
 * Het ronde "+"-knopje rechtsonder: staat `fixed` op elk tabblad onder "Campagnes"
 * (Campagnes, Tijdlijn, Campagnebeheer — zie AppShell) op dezelfde plek, ongeacht
 * scrollpositie. Opent het formulier voor een nieuwe campagne in een Modal.
 */
export default function NieuweCampagneKnop({ ingelogd }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nieuwe campagne toevoegen"
        title="Nieuwe campagne toevoegen"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-dropdown transition-colors duration-150 hover:bg-primary-dark"
      >
        <IconPlus className="h-6 w-6" />
      </button>

      {open && <NieuweCampagneModal ingelogd={ingelogd} onClose={() => setOpen(false)} />}
    </>
  );
}
