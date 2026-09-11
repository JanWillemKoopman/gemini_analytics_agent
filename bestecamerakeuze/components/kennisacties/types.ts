import type { NotitieSoort } from "@/lib/notities";

/**
 * De vorm waarin het tabblad "Kennis en acties" met berichten werkt.
 *
 * Dit zijn dezelfde rijen als het besluitenlogboek per campagne (`lib/campagneNotities.ts`),
 * maar bewust als een eigen, smal type: de tabel toont alleen datum, wie, campagne, soort
 * en tekst — de metriek en het nulpunt horen bij de campagnekolom waar ze zijn ingevuld,
 * niet bij dit overzicht.
 */
export interface Bericht {
  id: string;
  campagneNaam: string;
  tekst: string;
  soort: NotitieSoort;
  aangemaaktDoor: string;
  aangemaaktOp: string;
}

export interface Profiel {
  id: string;
  naam: string | null;
  avatarUrl: string | null;
}
