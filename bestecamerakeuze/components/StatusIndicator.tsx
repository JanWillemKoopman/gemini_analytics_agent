/** Kleine statusdot + label — bewust geen zware pill-badge, zie CampaignTable.
 *  `live` komt uit de start-/einddatum (zie lib/format.ts:isCampagneLive), niet uit de
 *  kolom "Status" in de sheet — die wordt hier bewust niet meer gelezen. */
export default function StatusIndicator({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${live ? "bg-open status-dot-ademen" : "bg-closed"}`}
      />
      {live ? "Online" : "Offline"}
    </span>
  );
}
