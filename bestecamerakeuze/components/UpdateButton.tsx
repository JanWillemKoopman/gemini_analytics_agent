"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { IconRefresh } from "@/components/icons";

type Props = {
  /** "Bijwerken" is de compacte variant binnen de filterbalk; "Data updaten" staat los in de header. */
  label?: string;
  variant?: "header" | "inline";
};

/**
 * Ververst de serverdata (nieuwe fetch van de Google Sheet + nieuw tijdstip) via
 * router.refresh(), zonder de client-state van de andere tabbladen te verliezen.
 * Een utility-actie, bewust geen primaire knop: dit is geen belangrijke beslissing,
 * gewoon "haal de laatste stand op". Header en filterbalk delen dezelfde actie, alleen
 * met andere styling.
 */
export default function UpdateButton({ label = "Data updaten", variant = "header" }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function bijwerken() {
    if (isPending) return;
    startTransition(() => {
      router.refresh();
    });
  }

  const busyLabel = variant === "header" ? "Bijwerken…" : "Bezig…";

  return (
    <button
      type="button"
      onClick={bijwerken}
      disabled={isPending}
      className={`flex shrink-0 items-center gap-1.5 rounded-control text-sm font-medium text-ink transition-colors duration-[var(--duur-snel)] disabled:cursor-wait disabled:opacity-70 ${
        variant === "header"
          ? "border border-line bg-card px-3 py-1.5 shadow-card hover:bg-surface"
          : "px-3 py-2 text-ink-muted hover:bg-surface hover:text-ink"
      }`}
    >
      <IconRefresh className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? busyLabel : label}
    </button>
  );
}
