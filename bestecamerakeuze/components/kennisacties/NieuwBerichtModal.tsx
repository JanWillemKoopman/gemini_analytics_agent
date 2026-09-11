"use client";

import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import Modal from "@/components/Modal";
import { SOORTEN, type NotitieSoort } from "@/lib/notities";
import { puntenVoor } from "@/lib/punten";
import type { Bericht, Profiel } from "@/components/kennisacties/types";

/** Sentinelwaarde in het uitklapmenu; geen campagnenaam kan hierop lijken. */
const VRIJ = "__eigen_onderwerp__";

type Props = {
  ingelogd: boolean;
  /** De campagnenamen uit de sheet, als suggesties in het uitklapmenu. */
  campagnes: string[];
  eigenNaam: string | null;
  eigenAvatarUrl: string | null;
  onClose: () => void;
  onToegevoegd: (bericht: Bericht, profiel: Profiel | null) => void;
};

/**
 * Een bericht vastleggen vanaf het tabblad "Kennis en acties".
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
export default function NieuwBerichtModal({
  ingelogd,
  campagnes,
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
      // Dezelfde schrijfroute als het logboek in de campagnekolom: één tabel, één
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
      onClose();
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon het bericht niet opslaan.");
    } finally {
      setBezig(false);
    }
  }

  if (!ingelogd) {
    return (
      <Modal title="Nieuw bericht" onClose={onClose}>
        <p className="text-sm text-ink-muted">Log in om een bericht vast te leggen.</p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </Modal>
    );
  }

  return (
    <Modal title="Nieuw bericht" onClose={onClose}>
      <form onSubmit={opslaan} className="flex flex-col gap-4">
        {/* Wie het vastlegt staat er als eerste, niet als kleine lettertjes onderaan:
            herleidbaarheid is het punt van het logboek. */}
        <div className="flex items-center gap-2.5 rounded-card border border-line px-3 py-2">
          <Avatar naam={eigenNaam} avatarUrl={eigenAvatarUrl} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{eigenNaam || "Naamloos"}</p>
            <p className="text-xs text-ink-faint">
              Legt dit vast — goed voor {puntenVoor(soort)} punten.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
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

          <span className="text-xs text-ink-faint">
            {keuze === VRIJ
              ? "Dit blijft een los inzicht op dit tabblad; er wordt geen campagne van gemaakt."
              : "Staat het onderwerp er niet bij? Kies onderaan \u201cEigen onderwerp\u201d."}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="label-theme text-label text-ink-faint">Type bericht</span>
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
        </div>

        <label className="flex flex-col gap-1">
          <span className="label-theme text-label text-ink-faint">Het bericht</span>
          <textarea
            value={tekst}
            disabled={bezig}
            rows={4}
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
        </label>

        {fout && <p className="text-sm text-negative">{fout}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={bezig}
            className="rounded-control border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-60"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={bezig}
            className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60"
          >
            {bezig ? "Opslaan…" : "Bericht vastleggen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
