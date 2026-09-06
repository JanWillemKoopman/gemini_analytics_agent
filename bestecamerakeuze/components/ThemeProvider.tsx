"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  isThemeId,
  STANDAARD_THEME,
  THEME_OPSLAG_SLEUTEL,
  vindTheme,
  type GrafiekKleuren,
  type ThemeId,
} from "@/lib/themes";

type ThemeContextWaarde = {
  theme: ThemeId;
  kiesTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextWaarde>({
  theme: STANDAARD_THEME,
  kiesTheme: () => {},
});

/**
 * Houdt bij welk theme actief is en zet dat als `data-theme` op `<html>`; alle
 * kleur-, font- en radius-tokens in `app/globals.css` hangen aan die attribuutwaarde.
 *
 * De keuze staat in localStorage, zodat hij per browser blijft hangen — er is geen
 * gebruikersvoorkeur in de database voor nodig, en hij werkt ook als je niet ingelogd
 * bent. Het attribuut wordt al vóór de eerste paint gezet door een klein inline script
 * in `app/layout.tsx`; deze provider leest die stand bij het mounten gewoon weer uit,
 * zodat React en de DOM het over hetzelfde theme eens zijn zonder hydration-mismatch
 * (de server rendert altijd het standaardtheme).
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(STANDAARD_THEME);

  useEffect(() => {
    const opgeslagen = document.documentElement.dataset.theme;
    if (isThemeId(opgeslagen) && opgeslagen !== STANDAARD_THEME) setTheme(opgeslagen);
  }, []);

  const kiesTheme = useCallback((id: ThemeId) => {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_OPSLAG_SLEUTEL, id);
    } catch {
      // Privacymodus of geblokkeerde opslag: het theme werkt deze sessie gewoon, het
      // onthouden lukt alleen niet. Geen reden om de UI te laten struikelen.
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, kiesTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextWaarde {
  return useContext(ThemeContext);
}

/**
 * De grafiekkleuren van het actieve theme. Recharts zet kleuren als SVG-attribuut
 * (`fill`, `stroke`) en die lezen geen CSS-variabelen — vandaar dat een grafiek zijn
 * palet via deze hook uit TypeScript haalt in plaats van uit de tokens.
 */
export function useGrafiekKleuren(): GrafiekKleuren {
  return vindTheme(useTheme().theme).grafiek;
}
