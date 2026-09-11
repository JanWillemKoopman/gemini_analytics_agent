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
    >
      <div
        className="h-full rounded-pill bg-progress-fill transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
