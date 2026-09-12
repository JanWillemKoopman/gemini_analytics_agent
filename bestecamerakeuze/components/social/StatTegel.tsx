/**
 * Één kerncijfer uit de gekozen periode.
 *
 * Volgt het databestand van de campagnetabel: label klein/uppercase/gedempt, de
 * primaire waarde zwaar en donker, en eronder een ondersteunende regel in `text-meta`
 * met wat het cijfer betekent (een verhouding, een gemiddelde, een kanttekening). Die
 * onderregel is geen optie maar het punt van de tegel — een kaal getal zonder context
 * is precies wat "Don't Make Me Think" niet wil.
 */
export default function StatTegel({
  label,
  waarde,
  onder,
}: {
  label: string;
  waarde: string;
  onder?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-card px-5 py-4">
      <p className="label-theme text-label tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1.5 font-sans-w7 text-3xl leading-none font-bold text-ink tabular-nums">
        {waarde}
      </p>
      <p className="mt-1.5 text-meta text-ink-faint">{onder ?? " "}</p>
    </div>
  );
}
