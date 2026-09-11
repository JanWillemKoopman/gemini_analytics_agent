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
 * Generieke pop-up: centraal paneel + backdrop, sluit op Escape of een klik ernaast.
 *
 * Wordt via een portal direct in <body> gerenderd in plaats van op zijn plek in de
 * component-boom. Zonder portal kan een knop die vanuit een sticky tabelkop wordt
 * geopend (zoals de aantekeningen bij een campagne) zijn eigen z-index niet laten
 * winnen van andere sticky cellen elders in de tabel — sticky elementen met z-index
 * vormen elk hun eigen stacking context, en die wordt alleen vergeleken met siblings
 * daarbinnen, niet globaal. Een portal naar <body> omzeilt dat volledig.
 */
export default function Modal({ title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [gemount, setGemount] = useState(false);

  useEffect(() => {
    setGemount(true);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!gemount) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-panel border border-line bg-card shadow-modal"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="font-sans-w7 text-sm font-bold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-faint transition-colors duration-[var(--duur-snel)] hover:bg-surface hover:text-ink"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
