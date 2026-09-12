"use client";

import { getBrandLogo } from "@/components/brandLogos";
import LogoMark from "@/components/LogoMark";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES } from "@/lib/themes";

/**
 * De donkere merkschil links op het inlogscherm.
 *
 * Zelfde materiaal als de sidebar van het dashboard (`.sidebar-vlak`, dus inclusief het
 * verloop van het gekozen theme): wie inlogt ziet al waar hij binnenkomt. De luxe zit
 * hier niet in extra kleur maar in de opbouw — een beeldmerk met wordmark bovenaan, één
 * regel over waar het dashboard voor is, en onderaan de merken die het huis verkoopt als
 * eenkleurige logo's. Plus een dunne binnenlijn op afstand van de rand, zoals de
 * kaderlijn van gedrukt briefpapier.
 *
 * Het grote logo op de achtergrond is het merkteken van het actieve theme, sterk
 * uitvergroot en bijna transparant: één signaal, geen tweede patroon bovenop de textuur
 * die het theme al meebrengt.
 */

/** De merken uit de themalijst waarvoor een eenkleurig logo bestaat (CUPRA niet). */
const MERKEN = THEMES.flatMap((t) => {
  if (t.id === "udenhout") return [];
  const Logo = getBrandLogo(t.id);
  return Logo ? [{ id: t.id, naam: t.naam, Logo }] : [];
});

export default function MerkPaneel() {
  const { theme } = useTheme();
  const Watermerk = getBrandLogo(theme);

  return (
    <aside className="sidebar-vlak inlog-schil relative isolate flex min-h-screen flex-col justify-between overflow-hidden px-16 py-14 text-sidebar-ink">
      {/* Binnenlijn: één haarlijn op afstand van de rand, de rust van een kaderlijn. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-6 rounded-panel border border-sidebar-line"
      />

      {/* Het merkteken van het actieve theme, sterk uitvergroot en bijna transparant:
          diepte zonder een tweede patroon bovenop de textuur die het theme al
          meebrengt. In de eigen huisstijl (en bij CUPRA) is er geen logo in de set —
          daar blijft alleen de lichtbundel van `.inlog-schil` staan, en dat is precies
          één signaal, zoals de themes het overal doen. */}
      {Watermerk && (
        <Watermerk
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 bottom-[-16%] h-[36rem] w-[36rem] text-sidebar-ink opacity-[0.05]"
        />
      )}

      <div className="relative flex items-center gap-4">
        <LogoMark className="h-11 w-11" />
        <span className="flex flex-col leading-tight">
          <span className="font-sans-w7 text-cell tracking-tight">Van den Udenhout</span>
          <span className="label-theme text-label text-sidebar-ink-muted">
            Campagnedashboard
          </span>
        </span>
      </div>

      <div className="relative max-w-[30rem]">
        <p className="titel-theme text-sidebar-ink">
          Elke week samen naar de cijfers kijken.
        </p>
        <p className="mt-5 text-base leading-relaxed text-sidebar-ink-muted">
          Alle campagnes naast elkaar, de besluiten die het team erover neemt, en volgende
          week het cijfer waar dat besluit op landde.
        </p>
      </div>

      <div className="relative">
        <p className="label-theme text-label text-sidebar-ink-muted">
          De merken van het huis
        </p>
        <ul className="mt-5 flex items-center gap-7">
          {MERKEN.map(({ id, naam, Logo }) => (
            <li key={id}>
              <Logo
                role="img"
                aria-label={naam}
                className="h-[22px] w-[22px] text-sidebar-ink opacity-45 transition-opacity duration-[var(--duur-snel)] ease-merk hover:opacity-90"
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
