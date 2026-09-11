/**
 * Wat er op een tabblad staat als je niet ingelogd bent. Alles wat het team zelf
 * vastlegt hangt aan een account — zonder sessie valt er niets te tonen en niets vast te
 * leggen, dus tonen we geen leeg scherm maar de knop die je nodig hebt.
 */
export default function Inlogprompt({ tekst }: { tekst: string }) {
  return (
    <div className="rounded-panel border border-line bg-card px-5 py-6 shadow-card">
      <p className="text-sm text-ink-muted">{tekst}</p>
      <a
        href="/login"
        className="mt-4 inline-block rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
      >
        Inloggen
      </a>
    </div>
  );
}
