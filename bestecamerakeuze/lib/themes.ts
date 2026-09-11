/**
 * De themes van het dashboard.
 *
 * Elk theme is de vormgeving van één automerk uit de Volkswagen Groep, doorgevoerd over
 * het hele dashboard: fonts, lettergroottes, tekstkleuren, achtergronden, borders,
 * hoekradii en schaduwen. De kleuren/typografie zelf staan als CSS-tokens in
 * `app/globals.css` onder `[data-theme="…"]` — één plek, precies zoals de rest van het
 * ontwerp al werkt. Dit bestand houdt alleen bij wélke themes er zijn, hoe ze in het
 * uitklapmenu heten, en wat een grafiek als kleuren moet gebruiken (SVG-attributen
 * kunnen geen CSS-variabelen lezen, dus die reeks moet in TypeScript bestaan).
 *
 * Nieuw theme toevoegen = een `[data-theme="…"]`-blok in globals.css + een regel
 * hieronder. Verder hoeft er nergens iets te veranderen: alle componenten gebruiken de
 * semantische tokens (`bg-card`, `text-ink`, `rounded-card`, `font-sans-w7`, …).
 */

export type ThemeId =
  | "udenhout"
  | "volkswagen"
  | "audi"
  | "skoda"
  | "seat"
  | "cupra"
  | "porsche"
  | "bentley";

/**
 * Grafiekkleuren van één theme.
 *
 * De huisstijlkleuren van een automerk zijn ontworpen voor tekst en vlakken, niet voor
 * datavisualisatie — zie de toelichting in `components/chat/chartTheme.ts`. Per theme
 * staat hier daarom een doorgerekende reeks: dezelfde sfeer als het merk, maar met
 * genoeg onderling verschil in lichtheid en chroma om naast elkaar leesbaar te blijven,
 * ook op een donkere achtergrond.
 */
export type GrafiekKleuren = {
  /** Vaste volgorde; kleur volgt de categorie, niet zijn positie in de ranglijst. */
  categorieen: readonly string[];
  /** "Eén ding is het punt, de rest is context." */
  context: string;
  /** Astekst. */
  as: string;
  /** Hairline-raster, effen — nooit gestippeld. */
  raster: string;
  /** De vlakkleur waar de grafiek op staat (voor uitsparingen in donut/lijnpunten). */
  vlak: string;
  /** Tekstkleur van een label bovenop een staaf. */
  label: string;
  /** Dikte van de lijn in een lijngrafiek — Bentley trekt een haarlijn, VW een volle. */
  lijndikte: number;
  /** Vloeiend of recht van punt naar punt: Porsche en CUPRA tekenen hoekig. */
  lijnvorm: "monotone" | "linear";
  /** Vorm van het eindpunt op de lijn. */
  punt: "gevuld" | "open" | "vierkant";
  /** Hoekradius van het staafeinde; 999 maakt er een pil van, 0 een rechte staaf. */
  staafradius: number;
};

export type Theme = {
  id: ThemeId;
  /** Zoals het in het uitklapmenu staat. */
  naam: string;
  /** Eén regel over de vormgeving van dit merk — waarom het theme eruitziet zoals het eruitziet. */
  omschrijving: string;
  /** Drie kleuren voor het staaltje in het menu: vlak, inkt, accent. */
  staal: [string, string, string];
  grafiek: GrafiekKleuren;
};

export const THEMES: readonly Theme[] = [
  {
    id: "udenhout",
    naam: "Udenhout",
    omschrijving: "De eigen huisstijl: donkerblauw, zand en helderblauw.",
    staal: ["#f7f6f3", "#19243b", "#003da5"],
    grafiek: {
      categorieen: ["#2563c9", "#ed6935", "#0d8f7f", "#b3312c", "#8258c4", "#a97400"],
      context: "#b6b3ad",
      as: "#5b6472",
      raster: "rgba(25, 36, 59, 0.10)",
      vlak: "#ffffff",
      label: "#19243b",
      lijndikte: 2,
      lijnvorm: "monotone",
      punt: "gevuld",
      staafradius: 4,
    },
  },
  {
    id: "volkswagen",
    naam: "Volkswagen",
    omschrijving: "Deep Space Blue op licht grijs, ronde pilvormen, rustige geometrie.",
    staal: ["#f0f2f5", "#001e50", "#00b0f0"],
    grafiek: {
      categorieen: ["#1e6bd6", "#00b0f0", "#00875a", "#c4451c", "#7a5af8", "#a37200"],
      context: "#b3bcc9",
      as: "#5a6a80",
      raster: "rgba(0, 30, 80, 0.12)",
      vlak: "#ffffff",
      label: "#001e50",
      lijndikte: 2.5,
      lijnvorm: "monotone",
      punt: "gevuld",
      staafradius: 999,
    },
  },
  {
    id: "audi",
    naam: "Audi",
    omschrijving: "Bijna-zwart canvas, brede Audi-letter, Progressive Red als enige accent.",
    staal: ["#181d25", "#fcfcfd", "#f50537"],
    grafiek: {
      categorieen: ["#f50537", "#f5f5f7", "#5aa9ff", "#ffb020", "#31d0aa", "#b57bff"],
      context: "#5a616d",
      as: "#9aa1ad",
      raster: "rgba(255, 255, 255, 0.12)",
      vlak: "#181d25",
      label: "#fcfcfd",
      lijndikte: 2,
      lijnvorm: "monotone",
      punt: "gevuld",
      staafradius: 999,
    },
  },
  {
    id: "skoda",
    naam: "Škoda",
    omschrijving: "Emerald Green met Electric Green, zachte vormen, veel wit.",
    staal: ["#f2f5f2", "#0e3a2f", "#78faae"],
    grafiek: {
      categorieen: ["#0e6b4f", "#2fb37a", "#1e6bd6", "#c4451c", "#7a5af8", "#a37200"],
      context: "#adbbb3",
      as: "#4f6a60",
      raster: "rgba(14, 58, 47, 0.12)",
      vlak: "#ffffff",
      label: "#0e3a2f",
      lijndikte: 2.5,
      lijnvorm: "monotone",
      punt: "gevuld",
      staafradius: 3,
    },
  },
  {
    id: "seat",
    naam: "SEAT",
    omschrijving: "Mediterraan: warm zandwit, zwarte inkt, SEAT-rood als accent.",
    staal: ["#f5f3f0", "#111111", "#e4002b"],
    grafiek: {
      categorieen: ["#d81f36", "#e2801e", "#0f8f8a", "#2a5fd0", "#8b4fc9", "#8a7000"],
      context: "#bdb6ae",
      as: "#67625c",
      raster: "rgba(17, 17, 17, 0.12)",
      vlak: "#ffffff",
      label: "#111111",
      lijndikte: 2,
      lijnvorm: "monotone",
      punt: "gevuld",
      staafradius: 999,
    },
  },
  {
    id: "cupra",
    naam: "CUPRA",
    omschrijving: "Petrol blue met koper, scherpe hoeken, kapitalen met ruime spatiëring.",
    staal: ["#0a1416", "#f2f0ed", "#b58150"],
    grafiek: {
      categorieen: ["#c08a55", "#e8e3dc", "#4fa6a8", "#e0554a", "#8f7fd6", "#d0a52e"],
      context: "#4d5c5e",
      as: "#93a1a3",
      raster: "rgba(242, 240, 237, 0.12)",
      vlak: "#0e1a1d",
      label: "#f2f0ed",
      lijndikte: 1.5,
      lijnvorm: "linear",
      punt: "vierkant",
      staafradius: 0,
    },
  },
  {
    id: "porsche",
    naam: "Porsche",
    omschrijving: "Technisch en precies: strakke hoeken, grijze vlakken, Porsche-rood.",
    staal: ["#eeeff2", "#010205", "#d5001c"],
    grafiek: {
      categorieen: ["#d5001c", "#2175d9", "#018a16", "#8a4fd0", "#b06a00", "#0e8f8a"],
      context: "#b4b7bb",
      as: "#626669",
      raster: "rgba(1, 2, 5, 0.12)",
      vlak: "#ffffff",
      label: "#010205",
      lijndikte: 1.5,
      lijnvorm: "linear",
      punt: "vierkant",
      staafradius: 2,
    },
  },
  {
    id: "bentley",
    naam: "Bentley",
    omschrijving: "Crème en British Racing Green, goud accent, geserifde kapitaalkoppen.",
    staal: ["#f5f2eb", "#10231c", "#b08d45"],
    grafiek: {
      categorieen: ["#1c6b4b", "#b08d45", "#2a5fd0", "#b0452e", "#7a5f9e", "#7d7a2e"],
      context: "#bdb6a5",
      as: "#5d6b62",
      raster: "rgba(26, 43, 35, 0.14)",
      vlak: "#ffffff",
      label: "#10231c",
      lijndikte: 1.25,
      lijnvorm: "monotone",
      punt: "open",
      staafradius: 0,
    },
  },
] as const;

export const STANDAARD_THEME: ThemeId = "udenhout";

/** Sleutel in localStorage; ook gebruikt door het no-flash-script in `app/layout.tsx`. */
export const THEME_OPSLAG_SLEUTEL = "dashboard-theme";

export function isThemeId(waarde: unknown): waarde is ThemeId {
  return typeof waarde === "string" && THEMES.some((t) => t.id === waarde);
}

export function vindTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
