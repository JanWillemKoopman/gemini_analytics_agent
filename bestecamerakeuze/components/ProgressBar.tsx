/** Kleine, subtiele voortgangsindicator — alleen zinvol met een echte doelwaarde. */
export default function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1 w-full max-w-24 overflow-hidden rounded-pill bg-progress-track"
    >
      <div
        className="h-full rounded-pill bg-progress-fill transition-[width] duration-[var(--duur-traag)]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
