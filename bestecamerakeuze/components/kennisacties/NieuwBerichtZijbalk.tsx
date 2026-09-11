"use client";

import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import Drawer from "@/components/Drawer";
import { initialenVoor } from "@/lib/initialen";
import { SOORTEN, SOORT_LABEL, type NotitieSoort } from "@/lib/notities";
import { puntenVoor } from "@/lib/punten";
import type { Bericht, Profiel } from "@/components/kennisacties/types";

/** Sentinelwaarde in het uitklapmenu; geen campagnenaam kan hierop lijken. */
const VRIJ = "__eigen_onderwerp__";

/** Hoeveel eerdere berichten er onder het formulier passen zonder een archief te worden. */
const RECENT_AANTAL = 20;

type Props = {
  ingelogd: boolean;
  /** De campagnenamen uit de sheet, als opties in het uitklapmenu. */
  campagnes: string[];
  /** Alles wat er al vastligt, nieuwste eerst — de lijst onder het formulier. */
  berichten: Bericht[];
  profielen: Record<string, Profiel>;
  eigenNaam: string | null;
  eigenAvatarUrl: string | null;
  onClose: () => void;
  onToegevoegd: (bericht: Bericht, profiel: Profiel | null) => void;
};

const SOORT_STIJL: Record<NotitieSoort, string> = {
  observatie: "bg-surface text-ink-muted",
  hypothese: "bg-surface text-ink-muted",
  besluit: "bg-primary-light text-primary",
  actie: "bg-surface-tint text-ink-muted",
};

function formatDatum(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(datum);
}

/**
 * Een bericht vastleggen vanaf het tabblad "Kennis en acties".
 *
 * Schuift als zijbalk van rechts in (`Drawer.tsx`), net als het logboek bij Campagnes —
 * dezelfde handeling hoort overal dezelfde beweging te maken. En net als daar staat het
 * invulgedeelte bovenaan met de al vastgelegde berichten eronder: je ziet terwijl je typt
 * wat er net is toegevoegd en wat er al stond. Daarom blijft de zijbalk na opslaan ook
 * gewoon openstaan — alleen het tekstveld leegt, zodat je er nog een kwijt kunt.
 *
 * Over de campagnekeuze: een uitklapmenu met de campagnes uit de sheet plus één extra optie
 * ("Eigen onderwerp"), die een tekstveld eronder opent. Bewust een echte `select` en geen
 * invoerveld met suggestielijst: Chromium laat bij zo'n lijst niets zien waaruit blijkt dát
 * er iets uit te klappen valt, en dan typt iedereen campagnenamen over — met spelfouten, en
 * dus met aantekeningen die nergens meer bij horen.
 *
 * Een eigen onderwerp hoeft verder niets in de database: een aantekening hangt aan een
 * campagne*naam*, niet aan een record (de campagnes zelf staan in de Google Sheet, zie
 * CLAUDE.md). Een naam die niet in de sheet voorkomt, komt daardoor vanzelf nergens bij de
 * campagnes terecht — hij blijft een los inzicht in dit overzicht, gemarkeerd als
 * "vrij onderwerp". De sheet blijft de bron.
 */
export default function NieuwBerichtZijbalk({
  ingelogd,
  campagnes,
  berichten,
  profielen,
  eigenNaam,
  eigenAvatarUrl,
  onClose,
  onToegevoegd,
}: Props) {
  // "" = nog niets gekozen, VRIJ = eigen onderwerp, anders de campagnenaam zelf.
  const [keuze, setKeuze] = useState("");
  const [vrijOnderwerp, setVrijOnderwerp] = useState("");
  const [soort, setSoort] = useState<NotitieSoort>("observatie");
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const gekozenSoort = useMemo(() => SOORTEN.find((s) => s.waarde === soort), [soort]);
  const recent = useMemo(() => berichten.slice(0, RECENT_AANTAL), [berichten]);

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (bezig) return;

    const naam = (keuze === VRIJ ? vrijOnderwerp : keuze).trim();
    const inhoud = tekst.trim();
    if (!naam) {
      setFout("Kies een campagne of vul een eigen onderwerp in.");
      return;
    }
    if (!inhoud) {
      setFout("Het bericht zelf mag niet leeg zijn.");
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      // Dezelfde schrijfroute als het logboek in de campagnezijbalk: één tabel, één
      // validatie. De metriek blijft hier leeg — die hoort bij het cijfer dat je in de
      // campagnetabel voor je ziet, niet bij een los vastgelegd inzicht.
      const res = await fetch("/api/campagne-notities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campagne: naam, tekst: inhoud, soort }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        fout?: string;
        item?: Bericht;
        profiel?: Profiel | null;
      };
      if (!res.ok || !json.item) throw new Error(json.fout ?? "Kon het bericht niet opslaan.");
      onToegevoegd(json.item, json.profiel ?? null);
      // Alleen de tekst leegmaken: campagne en soort blijven staan, want een tweede
      // aantekening gaat meestal over hetzelfde.
      setTekst("");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon het bericht niet opslaan.");
    } finally {
      setBezig(false);
    }
  }

  if (!ingelogd) {
    return (
      <Drawer title="Kennis en acties" onClose={onClose}>
        <p className="text-sm text-ink-muted">Log in om een bericht vast te leggen.</p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </Drawer>
    );
  }

  return (
    <Drawer title="Kennis en acties" onClose={onClose}>
      <form onSubmit={opslaan} className="flex flex-col gap-3">
        <p className="label-theme text-label text-ink-faint">Nieuw bericht</p>

        <div className="flex flex-wrap gap-1">
          {SOORTEN.map((s) => (
            <button
              key={s.waarde}
              type="button"
              onClick={() => setSoort(s.waarde)}
              title={s.uitleg}
              className={`rounded-button px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                soort === s.waarde
                  ? "bg-primary text-on-primary"
                  : "border border-line text-ink-muted hover:border-primary/40 hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {gekozenSoort && <p className="text-xs text-ink-faint">{gekozenSoort.uitleg}</p>}

        <textarea
          value={tekst}
          disabled={bezig}
          rows={3}
          onChange={(e) => setTekst(e.target.value)}
          placeholder={
            soort === "besluit"
              ? "Wat hebben we besloten?"
              : soort === "hypothese"
                ? "Wat verwachten we, en waarom?"
                : soort === "actie"
                  ? "Wat gaat wie doen?"
                  : "Wat zie je in de cijfers?"
          }
          className="resize-none rounded-control border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary disabled:opacity-60"
        />

        <label className="flex flex-col gap-1">
          <span className="label-theme text-label text-ink-faint">Campagne</span>
          <select
            value={keuze}
            disabled={bezig}
            onChange={(e) => setKeuze(e.target.value)}
            className="rounded-control border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
          >
            <option value="">Kies een campagne…</option>
            {campagnes.map((naam) => (
              <option key={naam} value={naam}>
                {naam}
              </option>
            ))}
            <option value={VRIJ}>Eigen onderwerp (niet aan een campagne gekoppeld)</option>
          </select>
        </label>

        {keuze === VRIJ && (
          <input
            type="text"
            value={vrijOnderwerp}
            disabled={bezig}
            autoFocus
            placeholder="Waar gaat het over?"
            onChange={(e) => setVrijOnderwerp(e.target.value)}
            className="rounded-control border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary disabled:opacity-60"
          />
        )}

        <p className="text-xs text-ink-faint">
          {keuze === VRIJ
            ? "Dit blijft een los inzicht op dit tabblad; er wordt geen campagne van gemaakt."
            : "Staat het onderwerp er niet bij? Kies onderaan “Eigen onderwerp”."}
        </p>

        {fout && <p className="text-sm text-negative">{fout}</p>}

        {/* Wie het vastlegt staat klein bij de knop in plaats van bovenaan: herleidbaarheid
            hoort erbij, maar het invulveld hoort het eerste te zijn wat je ziet. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs text-ink-faint">
            <Avatar naam={eigenNaam} avatarUrl={eigenAvatarUrl} size={20} />
            {eigenNaam || "Naamloos"} · {puntenVoor(soort)} punten
          </span>
          <button
            type="submit"
            disabled={bezig}
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
          >
            {bezig ? "Opslaan…" : "Bericht vastleggen"}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-line pt-4">
        <p className="label-theme text-label text-ink-faint">Eerder vastgelegd</p>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">Nog niets vastgelegd. Begin hierboven.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {recent.map((bericht) => {
              const profiel = profielen[bericht.aangemaaktDoor];
              return (
                <li key={bericht.id} className="flex items-start gap-2.5 rounded-card border border-line px-3 py-2">
                  <Avatar
                    naam={profiel?.naam ?? null}
                    avatarUrl={profiel?.avatarUrl ?? null}
                    size={22}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                      <span
                        className={`label-theme rounded-control px-1.5 py-0.5 text-label ${SOORT_STIJL[bericht.soort]}`}
                      >
                        {SOORT_LABEL[bericht.soort]}
                      </span>
                      <span className="font-medium">{initialenVoor(profiel?.naam ?? null)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDatum(bericht.aangemaaktOp)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{bericht.campagneNaam}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{bericht.tekst}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
