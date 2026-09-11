"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/icons";

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Zijbalk die van rechts over het scherm uitklapt: volledige schermhoogte, ongeveer een
 * derde van de breedte. Gebruikt voor content die meer ruimte verdient dan een
 * gecentreerde pop-up (`Modal.tsx`) maar niet de hele pagina hoeft over te nemen, zoals
 * het campagnelogboek (`CampaignNotes.tsx`).
 *
 * Rendert via een portal direct in <body>, om dezelfde reden als `Modal.tsx`: een knop
 * die vanuit een sticky tabelkop opent zit in zijn eigen stacking context en kan daar
 * niet met een hoge z-index uit ontsnappen.
 */
export default function Drawer({ title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [gemount, setGemount] = useState(false);
  const [zichtbaar, setZichtbaar] = useState(false);

  useEffect(() => {
    setGemount(true);
    // Eerst ongezien invoegen (translate-x-full), dan pas laten inschuiven — anders is
    // er niets om vanuit te animeren.
    const frame = requestAnimationFrame(() => setZichtbaar(true));
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  if (!gemount) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-ink/30 transition-opacity duration-200 ${
        zichtbaar ? "opacity-100" : "opacity-0"
      }`}
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-1/3 min-w-[420px] flex-col border-l border-line bg-card shadow-dropdown transition-transform duration-200 ease-out ${
          zichtbaar ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-6 py-4">
          <p className="font-sans-w7 text-sm font-bold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
