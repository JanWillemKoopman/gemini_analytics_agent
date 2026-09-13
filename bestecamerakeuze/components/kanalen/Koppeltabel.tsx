"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Inlogprompt from "@/components/Inlogprompt";
import FilterSelect from "@/components/FilterSelect";
import { IconCheck, IconInfo } from "@/components/icons";
import { formatteer } from "@/components/chat/chartTheme";

/**
 * De koppeltabel: campagne → campagnemanager, merk, categorie en de campagne uit de sheet.
 *
 * **Waarom deze pagina bestaat.** "Campagnemanager" komt in de Windsor-data niet voor —
 * alle 4.393 velden zijn doorzocht en er is geen eigenaarsveld. Het moet dus met de hand,
 * en dan is de vraag niet óf het wordt ingevuld maar of iemand ziet dát het ontbreekt.
 * Vandaar dat deze tabel begint bij de campagnes die geld kosten en pas daarna bij wat er
 * al gekoppeld is: de duurste campagne zonder eigenaar staat bovenaan.
 *
 * Opslaan gebeurt per veld zodra je het veld verlaat — geen aparte opslaan-knop, want
 * dat is bij een tabel met tientallen regels een uitnodiging om wijzigingen kwijt te
 * raken.
 */

export interface Koppeling {
  campagne: string;
  bron: string | null;
  eigenaarNaam: string | null;
  merk: string | null;
  categorie: string | null;
  sheetCampagne: string | null;
  notitie: string | null;
  uitgaven: number;
  gekoppeld: boolean;
}

const CATEGORIEEN = [
  "Acties",
  "After Sales",
  "Sales",
  "Vacatures",
  "Verhuur",
  "Branding",
];

const BRON_LABEL: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  linkedin: "LinkedIn",
};

export default function Koppeltabel({ ingelogd }: { ingelogd: boolean }) {
  const [rijen, setRijen] = useState<Koppeling[]>([]);
  const [bezig, setBezig] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [alleen, setAlleen] = useState<string[]>([]);
  const [bewaard, setBewaard] = useState<string | null>(null);

  const haal = useCallback(() => {
    setBezig(true);
    fetch("/api/kanalen?pagina=koppeltabel")
      .then(async (res) => {
        const data = (await res.json()) as { koppelingen?: Koppeling[]; fout?: string };
        if (!res.ok) {
          setFout(data.fout ?? `Ophalen mislukt (${res.status}).`);
          return;
        }
        setRijen(data.koppelingen ?? []);
        setFout(null);
      })
      .catch((err: unknown) => setFout(err instanceof Error ? err.message : String(err)))
      .finally(() => setBezig(false));
  }, []);

  useEffect(haal, [haal]);

  const zichtbaar = useMemo(() => {
    if (alleen.length === 0) return rijen;
    return rijen.filter((r) =>
      alleen.includes("Nog niet gekoppeld") ? !r.gekoppeld : r.gekoppeld,
    );
  }, [rijen, alleen]);

  const ongekoppeld = rijen.filter((r) => !r.gekoppeld);
  const ongekoppeldBudget = ongekoppeld.reduce((t, r) => t + r.uitgaven, 0);

  async function bewaar(campagne: string, patch: Partial<Koppeling>) {
    const huidig = rijen.find((r) => r.campagne === campagne);
    if (!huidig) return;
    // Stond hier eerst hard op `true`, dus ook het invullen van alleen het merk — of juist
    // het leegmaken van de naam — haalde het rode bolletje weg en verlaagde de teller
    // "zonder campagnemanager". Gekoppeld is precies één ding: er staat een naam.
    const samen = { ...huidig, ...patch };
    const nieuw = { ...samen, gekoppeld: Boolean(samen.eigenaarNaam?.trim()) };

    // Meteen in beeld bijwerken; de serveraanroep bevestigt alleen. Zou de tabel pas na
    // het antwoord bijwerken, dan springt elk veld even terug naar de oude waarde.
    setRijen((lijst) => lijst.map((r) => (r.campagne === campagne ? nieuw : r)));

    try {
      const res = await fetch("/api/kanalen/koppeling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nieuw),
      });
      if (!res.ok) {
        const data = (await res.json()) as { fout?: string };
        throw new Error(data.fout ?? `Opslaan mislukt (${res.status}).`);
      }
      setBewaard(campagne);
      setTimeout(() => setBewaard((c) => (c === campagne ? null : c)), 1500);
    } catch (err) {
      setFout(err instanceof Error ? err.message : String(err));
      haal(); // terug naar wat er echt staat
    }
  }

  if (!ingelogd) {
    return <Inlogprompt tekst="Log in om de koppeltabel te bekijken en bij te werken." />;
  }

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-1 mb-5 px-1 pt-1">
        <div className="kaart-omlijst flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-card px-4 py-3 shadow-card">
          <div className="flex items-center gap-4">
            <div>
              <p className="font-sans-w7 text-sm font-semibold text-ink">
                {bezig ? "Laden…" : `${zichtbaar.length} campagnes`}
              </p>
              <p className="text-meta text-ink-faint">
                {ongekoppeld.length} zonder campagnemanager
              </p>
            </div>
            {ongekoppeld.length > 0 && (
              <>
                <span aria-hidden="true" className="h-8 w-px bg-line" />
                <div>
                  <p className="font-sans-w7 text-sm font-semibold text-ink">
                    {formatteer(ongekoppeldBudget, "euro")}
                  </p>
                  <p className="text-meta text-ink-faint">
                    uitgegeven in 90 dagen zonder eigenaar
                  </p>
                </div>
              </>
            )}
          </div>

          <FilterSelect
            label="Tonen"
            options={["Nog niet gekoppeld", "Al gekoppeld"]}
            selected={alleen}
            onChange={setAlleen}
          />
        </div>
      </div>

      {fout && (
        <p className="mb-5 rounded-panel border border-line bg-card px-4 py-3 text-sm text-negative">
          {fout}
        </p>
      )}

      <p className="mb-4 flex items-start gap-2 text-meta text-ink-muted">
        <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        De campagnemanager staat niet in de data van de advertentieplatforms; die leggen we
        hier zelf vast. Alles wat je invult wordt meteen opgeslagen en werkt daarna als
        filter op de pagina&apos;s Social ads en Google Ads.
      </p>

      <section className="kaart-omlijst rounded-panel border border-line bg-card shadow-subtle">
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {["Campagne", "Kanaal", "Uitgaven 90 dgn", "Campagnemanager", "Merk", "Categorie", "Campagne in sheet"].map(
                  (kop, i) => (
                    <th
                      key={kop}
                      className={`sticky top-0 z-20 whitespace-nowrap border-b border-line bg-surface-tint px-4 py-2.5 ${
                        i === 0 ? "left-0 z-30 min-w-72 text-left" : i === 2 ? "text-right" : "text-left"
                      }`}
                    >
                      <span className="label-theme text-label text-ink-faint">{kop}</span>
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {!bezig && zichtbaar.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-muted">
                    Geen campagnes gevonden. Zodra de sync advertentiedata heeft opgehaald,
                    staan ze hier.
                  </td>
                </tr>
              )}
              {zichtbaar.map((rij) => (
                <tr key={rij.campagne}>
                  <td className="sticky left-0 z-10 border-b border-line-soft bg-card px-4 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      {!rij.gekoppeld && (
                        <span
                          title="Nog geen campagnemanager"
                          className="h-1.5 w-1.5 shrink-0 rounded-pill bg-negative"
                        />
                      )}
                      <span className="line-clamp-1 text-ink">{rij.campagne}</span>
                      {bewaard === rij.campagne && (
                        <IconCheck className="h-3.5 w-3.5 shrink-0 text-positive" />
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-b border-line-soft px-4 py-2 text-ink-muted">
                    {rij.bron ? (BRON_LABEL[rij.bron] ?? rij.bron) : "—"}
                  </td>
                  <td className="whitespace-nowrap border-b border-line-soft px-4 py-2 text-right text-ink">
                    {formatteer(rij.uitgaven, "euro")}
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <Veld
                      waarde={rij.eigenaarNaam}
                      plaatshouder="Naam invullen"
                      onBewaar={(v) => bewaar(rij.campagne, { eigenaarNaam: v })}
                    />
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <Veld
                      waarde={rij.merk}
                      plaatshouder="Merk"
                      onBewaar={(v) => bewaar(rij.campagne, { merk: v })}
                    />
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <Keuzeveld
                      waarde={rij.categorie}
                      opties={CATEGORIEEN}
                      onBewaar={(v) => bewaar(rij.campagne, { categorie: v })}
                    />
                  </td>
                  <td className="border-b border-line-soft px-2 py-1.5">
                    <Veld
                      waarde={rij.sheetCampagne}
                      plaatshouder="Naam in de sheet"
                      onBewaar={(v) => bewaar(rij.campagne, { sheetCampagne: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Eén bewerkbaar tekstveld; slaat op zodra het de focus verliest en er iets veranderd is. */
function Veld({
  waarde,
  plaatshouder,
  onBewaar,
}: {
  waarde: string | null;
  plaatshouder: string;
  onBewaar: (waarde: string | null) => void;
}) {
  const [tekst, setTekst] = useState(waarde ?? "");

  useEffect(() => setTekst(waarde ?? ""), [waarde]);

  return (
    <input
      value={tekst}
      placeholder={plaatshouder}
      onChange={(e) => setTekst(e.target.value)}
      onBlur={() => {
        const kaal = tekst.trim();
        if (kaal !== (waarde ?? "")) onBewaar(kaal || null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setTekst(waarde ?? "");
      }}
      className="w-full min-w-36 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm text-ink transition-colors duration-[var(--duur-snel)] placeholder:text-ink-faint hover:border-line focus:border-line focus:bg-card focus:outline-none"
    />
  );
}

function Keuzeveld({
  waarde,
  opties,
  onBewaar,
}: {
  waarde: string | null;
  opties: string[];
  onBewaar: (waarde: string | null) => void;
}) {
  return (
    <select
      value={waarde ?? ""}
      onChange={(e) => onBewaar(e.target.value || null)}
      className="w-full min-w-32 rounded-control border border-transparent bg-transparent px-2 py-1 text-sm text-ink transition-colors duration-[var(--duur-snel)] hover:border-line focus:border-line focus:bg-card focus:outline-none"
    >
      <option value="">—</option>
      {opties.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
