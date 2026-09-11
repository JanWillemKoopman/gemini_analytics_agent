import { IconNotes } from "@/components/icons";
import type { Campagne } from "@/lib/sheet";

/**
 * Subtiel knopje in de campagnekop dat het logboek van die campagne opent. Puur een
 * trigger: de open-state en de zijbalk zelf (`Drawer.tsx` + `NotitieLijst.tsx`) leven in
 * `CampaignHeader.tsx`, want de campagnenaam ernaast opent exact dezelfde zijbalk.
 */
export default function CampaignNotes({ campagne, onOpen }: { campagne: Campagne; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Logboek"
      aria-label={`Logboek voor ${campagne.naam}`}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint transition-colors duration-[var(--duur-snel)] hover:bg-surface hover:text-ink-muted"
    >
      <IconNotes className="h-3.5 w-3.5" />
    </button>
  );
}
