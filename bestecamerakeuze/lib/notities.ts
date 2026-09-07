import type { Campagne } from "@/lib/sheet";

/**
 * De soorten aantekening en de metrieken waar een besluit aan hangt.
 *
 * Waarom dit bestand bestaat: een aantekening was tot nu toe één regel tekst. Voor het
 * wekelijkse overleg is dat te weinig — je wilt volgende week kunnen zien wat er een
 * week eerder besloten is en of het cijfer daaronder ook echt bewogen heeft. Daarom
 * krijgt elke aantekening een soort, en vragen de twee sturende soorten (hypothese en
 * besluit) om het cijfer dat erdoor zou moeten veranderen.
 *
 * Puur en zonder database-afhankelijkheid, zodat zowel de client-UI als de
 * route-handlers hetzelfde lijstje gebruiken.
 */

export type NotitieSoort = "observatie" | "hypothese" | "besluit" | "actie";

export interface SoortInfo {
  waarde: NotitieSoort;
  label: string;
  /** Eén zin in de UI: wanneer kies je deze soort? */
  uitleg: string;
}

export const SOORTEN: SoortInfo[] = [
  {
    waarde: "observatie",
    label: "Observatie",
    uitleg: "Wat je ziet in de cijfers, zonder verklaring of conclusie.",
  },
  {
    waarde: "hypothese",
    label: "Hypothese",
    uitleg: "Een verwachting die je wilt toetsen: als we dit doen, verandert dat cijfer.",
  },
  {
    waarde: "besluit",
    label: "Besluit",
    uitleg: "Wat het team heeft besloten te gaan doen — met het cijfer dat het moet raken.",
  },
  {
    waarde: "actie",
    label: "Actie",
    uitleg: "Een concrete taak die iemand oppakt. Kan afgevinkt worden.",
  },
];

export const SOORT_LABEL: Record<NotitieSoort, string> = {
  observatie: "Observatie",
  hypothese: "Hypothese",
  besluit: "Besluit",
  actie: "Actie",
};

export function isNotitieSoort(waarde: unknown): waarde is NotitieSoort {
  return typeof waarde === "string" && waarde in SOORT_LABEL;
}

/** Alleen bij deze soorten vraagt de UI naar een metriek: een verwachting hoort meetbaar te zijn. */
export function vraagtOmMetriek(soort: NotitieSoort): boolean {
  return soort === "hypothese" || soort === "besluit";
}

/* ------------------------------------------------------------------ metrieken */

export type MetriekEenheid = "aantal" | "euro";

export interface Metriek {
  key: string;
  label: string;
  eenheid: MetriekEenheid;
  lees: (campagne: Campagne) => number | null;
}

/**
 * De cijfers uit de sheet waar een besluit realistisch aan kan hangen. Bewust kort: een
 * lijst van twintig keuzes maakt het invullen zwaarder dan het besluit zelf.
 */
export const METRIEKEN: Metriek[] = [
  { key: "leads", label: "Leads", eenheid: "aantal", lees: (c) => c.leads },
  { key: "leadsMarketing", label: "Online leads", eenheid: "aantal", lees: (c) => c.leadsMarketing },
  { key: "orders", label: "Orders", eenheid: "aantal", lees: (c) => c.orderTotaal },
  { key: "uitgaven", label: "Uitgaven", eenheid: "euro", lees: (c) => c.uitgaven },
];

export function vindMetriek(key: string | null): Metriek | null {
  if (!key) return null;
  return METRIEKEN.find((m) => m.key === key) ?? null;
}

/** De huidige stand van een metriek voor één campagne; null als het cijfer ontbreekt. */
export function huidigeMetriekWaarde(campagne: Campagne | null, key: string | null): number | null {
  const metriek = vindMetriek(key);
  if (!metriek || !campagne) return null;
  return metriek.lees(campagne);
}
