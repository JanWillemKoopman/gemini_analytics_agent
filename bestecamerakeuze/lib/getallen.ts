/**
 * Normaliseert een getal-invoer naar de NL-notatie (komma als decimaal) waarin de
 * sheet zelf ook getallen verwacht, ongeacht of iemand een punt of komma typte.
 * Lege invoer is toegestaan (maakt de cel leeg). Geeft `null` terug bij ongeldige invoer.
 */
export function normaliseerGetal(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  const numeriek = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(numeriek)) return null;
  return numeriek.toString().replace(".", ",");
}
