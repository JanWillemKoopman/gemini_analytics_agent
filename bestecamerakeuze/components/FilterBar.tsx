import type { ReactNode } from "react";
import { IconMegaphone } from "@/components/icons";

type Props = {
  totalCount: number;
  filteredCount: number;
  activeFilterCount: number;
  onClearAll?: () => void;
  children: ReactNode;
};

/**
 * Eén coherente controlbalk boven de tabel: aantal campagnes links, de vier filters en
 * "wis filters" rechts — geen losse knoppen die willekeurig verspreid staan.
 */
export default function FilterBar({
  totalCount,
  filteredCount,
  activeFilterCount,
  onClearAll,
  children,
}: Props) {
  const gefilterd = activeFilterCount > 0 && filteredCount !== totalCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 kaart-omlijst rounded-panel border border-line bg-card px-4 py-3 shadow-subtle">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface text-ink-muted">
          <IconMegaphone className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            {filteredCount} {filteredCount === 1 ? "campagne" : "campagnes"}
          </p>
          <p className="text-xs text-ink-faint">{gefilterd ? "Gefilterde selectie" : "Alle campagnes"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center divide-x divide-line">
        {children}
        {activeFilterCount > 0 && (
          <div className="pl-3">
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-control px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary-light"
            >
              Wis filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
