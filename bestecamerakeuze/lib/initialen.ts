/**
 * De initialen van een collega — het korte, herkenbare label dat overal staat waar geen
 * ruimte is voor een hele naam (avatar zonder foto, de kolom "Wie" in Kennis en acties).
 *
 * Losgetrokken uit `components/Avatar.tsx` zodat de tabel dezelfde twee letters toont
 * als het rondje ernaast; twee keer dezelfde afkortlogica schrijven levert vroeg of laat
 * twee verschillende uitkomsten op.
 */
export function initialenVoor(naam: string | null): string {
  if (!naam) return "?";
  const delen = naam.trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return "?";
  if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
  return (delen[0][0] + delen[delen.length - 1][0]).toUpperCase();
}
