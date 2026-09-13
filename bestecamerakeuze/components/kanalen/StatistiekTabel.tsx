"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { IconChevronDown, IconChevronUpDown, IconInfo } from "@/components/icons";
import { formatteer, type Eenheid } from "@/components/chat/chartTheme";
import { groepeer, waardeVan, type Kubus } from "@/lib/kanalen/kubus";
import type { Statistiek } from "@/lib/windsor/velden";

/**
 * De tabel onder de grafiek.
 *
 * Anders dan de campagnetabel op het tabblad Campagnes staan hier de rijen onder elkaar
 * en de statistieken naast elkaar: daar gaat het om een handvol campagnes die je naast
 * elkaar legt, hier om honderden advertenties waar je doorheen scrollt en op sorteert.
 * Dat is een bewust ander patroon voor een andere vraag, geen inconsistentie.
 *
 * **Alle statistieken zijn beschikbaar, niet alle staan aan.** Elke statistiek uit
 * `lib/windsor/velden.ts` is aan te zetten via "Kolommen"; wat er bij het openen staat is
 * wat `standaard: true` draagt. Zo is de tabel leesbaar bij binnenkomst en volledig als
 * je hem nodig hebt.
 */

type Props = {
  titel: string;
  toelichting: string;
  kubus: Kubus;
  rijen: number[][];
  /** Op welke dimensie de rijen worden samengevoegd. */
  groepeerOp: string;
  /** Kolomkop boven die dimensie. */
  groepLabel: string;
  statistieken: Statistiek[];
  /** Toont de creative of de post bij de naam, als de kubus die meedraagt. */
  toonBeeld?: boolean;
  uitlegAan: boolean;
};

export default function StatistiekTabel({
  titel,
  toelichting,
  kubus,
  rijen,
  groepeerOp,
  groepLabel,
  statistieken,
  toonBeeld = false,
  uitlegAan,
}: Props) {
  const [zichtbaar, setZichtbaar] = useState<string[]>(() =>
    statistieken.filter((s) => s.standaard).map((s) => s.id),
  );
  const [sorteerOp, setSorteerOp] = useState<string>(
    () => statistieken.find((s) => s.standaard)?.id ?? "",
  );
  const [oplopend, setOplopend] = useState(false);

  const kolommen = useMemo(
    () => statistieken.filter((s) => zichtbaar.includes(s.id)),
    [statistieken, zichtbaar],
  );

  const groepen = useMemo(() => {
    const basis = groepeer(kubus, rijen, groepeerOp);
    const statistiek = statistieken.find((s) => s.id === sorteerOp);
    if (!statistiek) return basis;
    return [...basis].sort((a, b) => {
      const wa = waardeVan(statistiek, a.totalen);
      const wb = waardeVan(statistiek, b.totalen);
      // Lege waarden horen onderaan, ongeacht de sorteerrichting: een advertentie zonder
      // klikken is geen "beste" resultaat bij oplopend sorteren op kosten per klik.
      if (wa === null && wb === null) return 0;
      if (wa === null) return 1;
      if (wb === null) return -1;
      return oplopend ? wa - wb : wb - wa;
    });
  }, [kubus, rijen, groepeerOp, statistieken, sorteerOp, oplopend]);

  function klikKolom(id: string) {
    if (id === sorteerOp) {
      setOplopend((v) => !v);
    } else {
      setSorteerOp(id);
      setOplopend(false);
    }
  }

  return (
    <section className="kaart-omlijst rounded-panel border border-line bg-card shadow-subtle">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-sans-w7 text-cell font-semibold text-ink">{titel}</h2>
          <p className="mt-0.5 text-meta text-ink-muted">
            {groepen.length} {groepen.length === 1 ? "regel" : "regels"} · {toelichting}
          </p>
        </div>
        <KolomKiezer
          statistieken={statistieken}
          zichtbaar={zichtbaar}
          onWijzig={setZichtbaar}
        />
      </header>

      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-64 border-b border-line bg-surface-tint px-4 py-2.5 text-left">
                <span className="label-theme text-label text-ink-faint">{groepLabel}</span>
              </th>
              {kolommen.map((s) => (
                <th
                  key={s.id}
                  className="sticky top-0 z-20 whitespace-nowrap border-b border-line bg-surface-tint px-4 py-2.5 text-right"
                >
                  <button
                    type="button"
                    onClick={() => klikKolom(s.id)}
                    className="inline-flex items-center gap-1 text-ink-muted transition-colors duration-[var(--duur-snel)] hover:text-ink"
                  >
                    <span className="label-theme text-label">{s.label}</span>
                    {s.id === sorteerOp ? (
                      <IconChevronDown
                        className={`h-3 w-3 ${oplopend ? "rotate-180" : ""}`}
                      />
                    ) : (
                      <IconChevronUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                  {uitlegAan && (
                    <span className="mt-1 block max-w-44 whitespace-normal text-right text-meta font-normal text-ink-faint">
                      {s.uitleg}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groepen.length === 0 && (
              <tr>
                <td
                  colSpan={kolommen.length + 1}
                  className="px-4 py-10 text-center text-ink-muted"
                >
                  Geen regels in deze selectie.
                </td>
              </tr>
            )}
            {groepen.map((groep) => {
              const extra = kubus.meta?.[groep.sleutel];
              return (
                <tr key={groep.sleutel}>
                  <td className="sticky left-0 z-10 border-b border-line-soft bg-card px-4 py-2.5 align-top">
                    <div className="flex items-start gap-2.5">
                      {toonBeeld && (
                        <Beeld
                          url={extra?.thumbnail_url ?? extra?.afbeelding_url ?? null}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-ink">{groep.label}</p>
                        {extra?.preview_url && (
                          <a
                            href={extra.preview_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-meta text-primary hover:underline"
                          >
                            Advertentie bekijken
                          </a>
                        )}
                        {extra?.permalink && (
                          <a
                            href={extra.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-meta text-primary hover:underline"
                          >
                            Post bekijken
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  {kolommen.map((s) => (
                    <td
                      key={s.id}
                      className="whitespace-nowrap border-b border-line-soft px-4 py-2.5 text-right text-ink"
                    >
                      {formatteer(waardeVan(s, groep.totalen), eenheidVan(s))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function eenheidVan(statistiek: Statistiek): Eenheid {
  if (statistiek.eenheid === "euro") return "euro";
  if (statistiek.eenheid === "procent") return "procent";
  return "aantal";
}

/** De creative naast de naam — vaak het snelste herkenpunt in een lange lijst. */
function Beeld({ url }: { url: string | null }) {
  if (!url) {
    return <span className="mt-0.5 block h-9 w-9 shrink-0 rounded-control bg-surface" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- de URL's komen van de CDN's
    // van Meta en Instagram en hebben een korte houdbaarheid; door next/image halen
    // levert alleen maar 404's op zodra de handtekening verloopt.
    <img
      src={url}
      alt=""
      loading="lazy"
      className="mt-0.5 h-9 w-9 shrink-0 rounded-control object-cover"
    />
  );
}

function KolomKiezer({
  statistieken,
  zichtbaar,
  onWijzig,
}: {
  statistieken: Statistiek[];
  zichtbaar: string[];
  onWijzig: (waarden: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function buiten(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", buiten);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", buiten);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function wissel(id: string) {
    onWijzig(
      zichtbaar.includes(id) ? zichtbaar.filter((v) => v !== id) : [...zichtbaar, id],
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-control border border-line px-3 py-1.5 text-sm text-ink-muted transition-colors duration-[var(--duur-snel)] hover:bg-surface hover:text-ink"
      >
        Kolommen
        <span className="text-ink-faint">({zichtbaar.length})</span>
        <IconChevronDown className={`h-3.5 w-3.5 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 max-h-80 w-72 overflow-auto rounded-control border border-line bg-card p-1.5 shadow-dropdown">
          <p className="flex items-start gap-1.5 px-2 py-1.5 text-meta text-ink-faint">
            <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Alle statistieken zijn beschikbaar; wat hier aanstaat is wat je in de tabel ziet.
          </p>
          {statistieken.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-control px-2 py-1.5 hover:bg-surface"
            >
              <input
                type="checkbox"
                checked={zichtbaar.includes(s.id)}
                onChange={() => wissel(s.id)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm text-ink">{s.label}</span>
                <span className="block text-meta text-ink-faint">{s.uitleg}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
