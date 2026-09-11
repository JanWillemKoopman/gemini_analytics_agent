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
 * De keuze staat in localStorage, zodat hij per browser blijft hangen zonder in te
 * hoeven loggen én al vóór de eerste paint gezet kan worden door het inline script in
 * `app/layout.tsx` (deze provider leest die stand bij het mounten gewoon weer uit,
 * zodat React en de DOM het over hetzelfde theme eens zijn zonder hydration-mismatch —
 * de server rendert altijd het standaardtheme).
 *
 * Voor een ingelogde collega is de keuze bovendien onderdeel van zijn profiel
 * (`dataloket.profielen.theme`, via `/api/profiel`), zodat hij ook op een ander
 * apparaat of na opnieuw inloggen terugkomt. Die ophaal gebeurt async ná de eerste
 * paint — er is dus even kort het localStorage-/standaardtheme te zien vóór het
 * profieltheme (indien anders) overneemt, net als elders in de app waar een
 * profielveld pas na een fetch verschijnt. Niet ingelogd, of geen Supabase
 * geconfigureerd: de fetch faalt gewoon stil en localStorage blijft de enige bron.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(STANDAARD_THEME);

  useEffect(() => {
    const opgeslagen = document.documentElement.dataset.theme;
    if (isThemeId(opgeslagen) && opgeslagen !== STANDAARD_THEME) setTheme(opgeslagen);
  }, []);

  useEffect(() => {
    let genegeerd = false;
    fetch("/api/profiel")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (genegeerd || !json) return;
        const profielTheme = json.profiel?.theme;
        if (isThemeId(profielTheme)) {
          setTheme(profielTheme);
          document.documentElement.dataset.theme = profielTheme;
        }
      })
      .catch(() => {
        // Niet ingelogd, geen Supabase, of een netwerkfout: het lokaal opgeslagen
        // theme (of het standaardtheme) blijft gewoon staan.
      });
    return () => {
      genegeerd = true;
    };
  }, []);

  const kiesTheme = useCallback((id: ThemeId) => {
    const toepassen = () => {
      setTheme(id);
      document.documentElement.dataset.theme = id;
    };

    // Een themewissel verzet het hele scherm in één keer; zonder overgang is dat een
    // flits. `startViewTransition` laat de browser het oude beeld over het nieuwe
    // uitvloeien — een paar honderd milliseconden, verder niets aan te sturen. Niet
    // elke browser kent het (en wie minder beweging wil, hoort het niet te krijgen),
    // dus het blijft een toevoeging op het gewone pad: valt het weg, dan wisselt het
    // theme gewoon direct zoals voorheen.
    const kanOvervloeien =
      typeof document.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (kanOvervloeien) {
      document.startViewTransition(toepassen);
    } else {
      toepassen();
    }
    try {
      window.localStorage.setItem(THEME_OPSLAG_SLEUTEL, id);
    } catch {
      // Privacymodus of geblokkeerde opslag: het theme werkt deze sessie gewoon, het
      // onthouden lukt alleen niet. Geen reden om de UI te laten struikelen.
    }
    // Ook op het profiel bewaren, zodat de keuze meegaat naar een ander apparaat. Geen
    // paniek als dit faalt (niet ingelogd, netwerkfout): localStorage is dan het vangnet.
    fetch("/api/profiel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: id }),
    }).catch(() => {});
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
