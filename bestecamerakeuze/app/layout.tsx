import type { Metadata } from "next";
import {
  Archivo,
  Barlow,
  Cormorant_Garamond,
  DM_Sans,
  Fira_Sans,
  Inter,
  Jost,
  Manrope,
  Saira,
} from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import { STANDAARD_THEME, THEME_OPSLAG_SLEUTEL, THEMES } from "@/lib/themes";
import "./globals.css";

/**
 * Eén font per theme (zie `app/globals.css`). De huisstijlletters van de automerken
 * zijn geen van alle vrij te gebruiken, dus dit zijn de dichtstbijzijnde vrije
 * benaderingen — gekozen op vorm, niet op naam:
 *
 * - Inter          → TheSansB (Udenhout)  — humanistisch, neutraal
 * - DM Sans        → VW Head / VW Text    — geometrisch, vriendelijk, hoge x-hoogte
 * - Archivo        → Audi Type Extended   — variabele breedte-as voor de "extended" kop
 * - Manrope        → Škoda Next / Pro     — geometrisch met licht afgeronde uiteinden
 * - Fira Sans      → SEAT Meta            — van dezelfde ontwerper als FF Meta
 * - Saira          → CUPRA                — smal, technisch, hoekig
 * - Barlow         → Porsche Next         — iets smallere, strakke grotesk
 * - Jost           → Bentley (lopend)     — Gill/Futura-achtige geometrische sans
 * - Cormorant Gar. → Bentley (koppen)     → geserifde kapitalen, klassiek en licht
 *
 * `preload: false` op de merkfonts: alleen het font van het gekozen theme wordt
 * daadwerkelijk gedownload (de browser haalt een @font-face pas op zodra hij hem nodig
 * heeft). Zonder dat zou elk bezoek negen fontfamilies binnentrekken voor één theme.
 * Inter blijft wél preloaden — dat is het standaardtheme.
 */
const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter" });

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-vw",
  preload: false,
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-audi",
  preload: false,
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-skoda",
  preload: false,
});

const firaSans = Fira_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-seat",
  preload: false,
});

const saira = Saira({
  subsets: ["latin", "latin-ext"],
  variable: "--font-cupra",
  preload: false,
});

const barlow = Barlow({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-porsche",
  preload: false,
});

const jost = Jost({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bentley",
  preload: false,
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bentley-kop",
  preload: false,
});

const fontVariabelen = [
  inter.variable,
  dmSans.variable,
  archivo.variable,
  manrope.variable,
  firaSans.variable,
  saira.variable,
  barlow.variable,
  jost.variable,
  cormorant.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Campagnedashboard",
  description: "Live overzicht van alle marketingcampagnes, naast elkaar te vergelijken.",
};

/**
 * Zet het opgeslagen theme op <html> vóór de eerste paint, zodat je bij het laden niet
 * eerst een flits van het standaardtheme ziet. Moet synchroon in de <head> draaien —
 * daarom een inline script en geen useEffect. De lijst met geldige id's wordt uit
 * `lib/themes.ts` ingebakken, zodat een oude of geknoeide waarde in localStorage nooit
 * ongecontroleerd in het DOM belandt.
 */
const themeScript = `
try {
  var g = ${JSON.stringify(THEMES.map((t) => t.id))};
  var t = localStorage.getItem(${JSON.stringify(THEME_OPSLAG_SLEUTEL)});
  document.documentElement.dataset.theme = g.indexOf(t) === -1 ? ${JSON.stringify(STANDAARD_THEME)} : t;
} catch (e) {}
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={fontVariabelen} data-theme={STANDAARD_THEME}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
