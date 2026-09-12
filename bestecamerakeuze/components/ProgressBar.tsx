/** Kleine, subtiele voortgangsindicator — alleen zinvol met een echte doelwaarde. */
export default function ProgressBar({
  percent,
  className = "h-1 max-w-24",
}: {
  percent: number;
  /** Hoogte en breedte van de balk; de standaard is de smalle variant in de campagnetabel. */
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full overflow-hidden rounded-pill bg-progress-track ${className}`}
      // De maatstreepjes op 25/50/75% horen bij het merk (Porsche zet ze erin, de rest
      // houdt de balk glad): --theme-progress-maatstreep staat overal behalve daar op
      // transparent, dus dit blijft één component zonder theme-kennis.
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, transparent 0 calc(25% - 1px), var(--theme-progress-maatstreep) calc(25% - 1px) 25%)",
      }}
    >
      <div
        className="h-full rounded-pill bg-progress-fill transition-[width] duration-[var(--duur-traag)] ease-merk"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
