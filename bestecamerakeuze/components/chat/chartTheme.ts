/**
 * Grafiekthema voor de chatantwoorden en de kostengrafiek.
 *
 * De huisstijlkleuren zijn ontworpen voor tekst en vlakken, niet voor datavisualisatie.
 * Het merkblauw #003da5 is te donker voor een grafiekmark (het valt buiten de
 * lichtheidsband waarin marks naast elkaar leesbaar blijven), en het zand #e2ddd1 heeft
 * te weinig contrast met het witte vlak. De reeks per theme is daarom afgeleid van de
 * huisstijl maar doorgerekend op leesbaarheid: lichtheidsband, chroma-ondergrens,
 * onderscheid bij kleurenblindheid (protan/deutan/tritan) en contrast met de
 * achtergrond van dat theme (bij Audi en CUPRA dus een donkere achtergrond).
 *
 * Alle zes de controles zijn gehaald voor het standaardtheme; de zwaarste combinatie is
 * teal↔oranje met een ΔE van 9,4 bij protanopie — ruim boven de ondergrens van 8.
 *
 * Belangrijk bij gebruik: een staafdiagram van categorieën is ÉÉN serie en krijgt dus
 * één kleur voor alle staven. De categoriereeks is uitsluitend voor échte identiteit —
 * donutsegmenten en meerdere lijnen — en wordt op volgorde toegekend, nooit herhaald.
 *
 * De kleuren zelf staan per theme in `lib/themes.ts`: Recharts zet ze als
 * SVG-attribuut (`fill`, `stroke`) en die lezen geen CSS-variabelen, dus ze kunnen niet
 * uit de tokens in globals.css komen. Componenten halen ze op met `useGrafiekKleuren()`
 * uit `components/ThemeProvider`.
 */

/** Astekst; de grootte is voor elk theme gelijk, alleen de kleur volgt het theme. */
export const AS_GROOTTE = 12;

export type Eenheid = "geen" | "euro" | "aantal" | "procent";

/**
 * Getalweergave in Nederlandse notatie. `compact` is voor astikken, waar 128400 als
 * "128k" moet passen; de volledige waarde staat altijd in de tooltip en de tabel.
 */
export function formatteer(
  waarde: number | null | undefined,
  eenheid: Eenheid,
  compact = false,
): string {
  if (waarde === null || waarde === undefined || Number.isNaN(waarde)) return "—";

  if (eenheid === "procent") {
    return `${waarde.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
  }

  if (compact && Math.abs(waarde) >= 1000) {
    const kort =
      Math.abs(waarde) >= 1_000_000
        ? `${(waarde / 1_000_000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}mln`
        : `${(waarde / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}k`;
    return eenheid === "euro" ? `€ ${kort}` : kort;
  }

  const getal = waarde.toLocaleString("nl-NL", {
    maximumFractionDigits: eenheid === "euro" ? 0 : 2,
  });
  return eenheid === "euro" ? `€ ${getal}` : getal;
}

/** Zet een databasewaarde om naar een getal; geeft null als het er geen is. */
export function alsGetal(waarde: unknown): number | null {
  if (typeof waarde === "number") return Number.isFinite(waarde) ? waarde : null;
  if (typeof waarde === "string") {
    const n = Number(waarde);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Leesbaar label van een willekeurige databasewaarde. */
export function alsLabel(waarde: unknown): string {
  if (waarde === null || waarde === undefined) return "onbekend";
  if (waarde instanceof Date) return waarde.toLocaleDateString("nl-NL");
  return String(waarde);
}
