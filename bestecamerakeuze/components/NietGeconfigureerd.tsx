type Props = {
  ontbreekt: string[];
  /** Overschrijft de kop; standaard de tekst van het chattabblad. */
  titel?: string;
  /** Overschrijft de inleidende zin boven de lijst. */
  inleiding?: string;
  /** Overschrijft de verwijzing naar de documentatie onderaan. */
  documentatie?: string;
};

/**
 * Wat een tabblad toont zolang de omgeving er nog niet compleet voor is.
 *
 * Bewust een duidelijke, feitelijke lijst in plaats van een foutmelding: dit is de
 * normale toestand tot de sheets, de database, de API-sleutels en de datafeeds zijn
 * aangesloten, en de tabbladen ernaast werken gewoon door. De teksten zijn instelbaar
 * omdat er meer dan één zo'n tabblad is (de chat en Social media hebben elk hun eigen
 * variabelen), maar de vorm blijft overal gelijk.
 */
export default function NietGeconfigureerd({
  ontbreekt,
  titel = "Het dataloket staat klaar, maar is nog niet aangesloten",
  inleiding = "De chat, de guardrails en het datawoordenboek zijn gebouwd. Er ontbreken nog omgevingsvariabelen voordat er echt gevraagd kan worden:",
  documentatie = "bestecamerakeuze/README-dataloket.md",
}: Props) {
  return (
    <div className="rounded-panel border border-line bg-surface p-8">
      <p className="font-sans-w7 text-lg font-bold text-ink">{titel}</p>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{inleiding}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {ontbreekt.map((item) => (
          <li key={item} className="flex gap-3 text-sm text-ink">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-2xl text-sm text-ink-muted">
        Zie <code className="rounded bg-card px-1.5 py-0.5 text-xs">{documentatie}</code> voor de
        stappen om dit aan te sluiten.
      </p>
    </div>
  );
}
