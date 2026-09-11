import type { Medaille } from "@/lib/punten";

/**
 * De medailles #1, #2 en #3, zoals ze op het scoretabblad en in de berichtentabel
 * staan.
 *
 * De kleuren zijn eigen tokens (`--color-goud/zilver/brons`) die in élk theme gelijk
 * blijven: goud in het merkpalet van Škoda is geen goud meer. Verder blijft het een
 * plat pilletje met een cijfer — geen glimmend medaille-icoon, want er staan er soms
 * drie tegelijk in beeld en het scherm moet rustig blijven.
 */
export const MEDAILLE_STIJL: Record<Medaille, string> = {
  1: "bg-goud",
  2: "bg-zilver",
  3: "bg-brons",
};

export const MEDAILLE_LABEL: Record<Medaille, string> = {
  1: "Eerste plaats",
  2: "Tweede plaats",
  3: "Derde plaats",
};

/** Het label dat over de rand van een avatar valt. */
export function Medaillelabel({ plek }: { plek: Medaille }) {
  return (
    <span
      title={MEDAILLE_LABEL[plek]}
      className={`absolute -bottom-1 -right-1 rounded-pill px-1.5 py-px font-sans-w7 text-label font-bold tabular-nums text-on-medaille ring-2 ring-card ${MEDAILLE_STIJL[plek]}`}
    >
      <span className="sr-only">{MEDAILLE_LABEL[plek]}: </span>#{plek}
    </span>
  );
}

/** Hetzelfde pilletje, maar inline in een tabelcel. */
export function MedaillePil({ plek, aantal }: { plek: Medaille; aantal?: number }) {
  return (
    <span
      title={aantal === undefined ? MEDAILLE_LABEL[plek] : `${aantal}× ${MEDAILLE_LABEL[plek].toLowerCase()}`}
      className={`inline-flex items-center gap-1 rounded-pill px-1.5 py-px font-sans-w7 text-label font-bold tabular-nums text-on-medaille ${MEDAILLE_STIJL[plek]}`}
    >
      <span className="sr-only">{MEDAILLE_LABEL[plek]}</span>
      <span aria-hidden="true">#{plek}</span>
      {aantal !== undefined && <span>· {aantal}</span>}
    </span>
  );
}
