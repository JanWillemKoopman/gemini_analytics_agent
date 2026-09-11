"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { IconCheck, IconPencil, IconPlus, IconTrash } from "@/components/icons";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  METRIEKEN,
  SOORTEN,
  SOORT_LABEL,
  huidigeMetriekWaarde,
  vindMetriek,
  vraagtOmMetriek,
  type NotitieSoort,
} from "@/lib/notities";
import type { Campagne } from "@/lib/sheet";

/**
 * Het besluitenlogboek van één campagne.
 *
 * Wat vroeger een platte lijst aantekeningen was, is nu het geheugen van het
 * weekoverleg: elke regel is een observatie, een hypothese, een besluit of een actie.
 * Bij een hypothese of een besluit wordt vastgelegd wélk cijfer erdoor moet veranderen
 * én wat dat cijfer op dat moment was — zodat je een week later niet hoeft te
 * discussiëren of er iets gebeurd is, maar het gewoon ziet staan.
 *
 * Wordt op twee plekken gebruikt: in de zijbalk vanuit de kolomkop (`CampaignNotes.tsx`,
 * via `Drawer.tsx`) en in de focusmodus onder de tabel. Vandaar dat het component zijn
 * eigen data ophaalt.
 *
 * Het invoerveld staat bovenaan — daar begint elk weekoverleg, niet onderaan een lijst
 * die je eerst voorbij moet scrollen — en de lijst eronder toont nieuw-naar-oud, zodat
 * de laatste aantekening altijd direct onder het invoerveld staat.
 */

export interface Notitie {
  id: string;
  tekst: string;
  soort: NotitieSoort;
  metriek: string | null;
  metriekWaarde: number | null;
  afgerondOp: string | null;
  aangemaaktDoor: string;
  aangemaaktOp: string;
}

interface Profiel {
  naam: string | null;
  avatarUrl: string | null;
}

type Props = {
  campagne: Campagne;
  ingelogd: boolean;
};

const SOORT_STIJL: Record<NotitieSoort, string> = {
  observatie: "bg-surface text-ink-muted",
  hypothese: "bg-surface text-ink-muted",
  besluit: "bg-primary-light text-primary",
  actie: "bg-surface-tint text-ink-muted",
};

function formatWaarde(waarde: number | null, eenheid: "aantal" | "euro"): string {
  return eenheid === "euro" ? formatCurrency(waarde) : formatNumber(waarde);
}

function formatDatum(iso: string): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return "";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" }).format(datum);
}

/**
 * De regel onder een besluit of hypothese: wat het cijfer was toen het werd vastgelegd,
 * en wat het nu is. Zonder nulpunt (oude aantekening, of cijfer ontbrak) blijft alleen
 * de metrieknaam over — beter een halve regel dan een verzonnen verschil.
 */
function MetriekVerloop({ notitie, campagne }: { notitie: Notitie; campagne: Campagne }) {
  const metriek = vindMetriek(notitie.metriek);
  if (!metriek) return null;

  const toen = notitie.metriekWaarde;
  const nu = huidigeMetriekWaarde(campagne, notitie.metriek);
  const verschil = toen !== null && nu !== null ? nu - toen : null;
  const toon =
    verschil === null || verschil === 0
      ? "text-ink-faint"
      : verschil > 0
        ? "text-positive"
        : "text-negative";

  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5 text-xs text-ink-faint">
      <span className="font-medium text-ink-muted">{metriek.label}</span>
      {toen === null ? (
        <span>— geen beginstand vastgelegd</span>
      ) : (
        <>
          <span className="tabular-nums">{formatWaarde(toen, metriek.eenheid)}</span>
          <span aria-hidden="true">→</span>
          <span className="tabular-nums text-ink">{formatWaarde(nu, metriek.eenheid)}</span>
          {verschil !== null && (
            <span className={`tabular-nums ${toon}`}>
              {verschil > 0 ? "+" : verschil < 0 ? "−" : ""}
              {formatWaarde(Math.abs(verschil), metriek.eenheid)} sindsdien
            </span>
          )}
        </>
      )}
    </p>
  );
}

export default function NotitieLijst({ campagne, ingelogd }: Props) {
  const [items, setItems] = useState<Notitie[] | null>(null);
  const [profielen, setProfielen] = useState<Record<string, Profiel>>({});
  const [laden, setLaden] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [nieuw, setNieuw] = useState("");
  const [soort, setSoort] = useState<NotitieSoort>("observatie");
  const [metriek, setMetriek] = useState<string>(METRIEKEN[0].key);
  const [bezigMetToevoegen, setBezigMetToevoegen] = useState(false);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [bewerkTekst, setBewerkTekst] = useState("");

  const campagneNaam = campagne.naam;

  useEffect(() => {
    if (!ingelogd) return;
    let genegeerd = false;
    setLaden(true);
    setFout(null);
    fetch(`/api/campagne-notities?campagne=${encodeURIComponent(campagneNaam)}`)
      .then((res) => res.json())
      .then((json) => {
        if (genegeerd) return;
        if (json.fout) throw new Error(json.fout);
        setItems(json.items as Notitie[]);
        setProfielen(json.profielen as Record<string, Profiel>);
      })
      .catch((err) => {
        if (!genegeerd) setFout(err instanceof Error ? err.message : "Kon aantekeningen niet ophalen.");
      })
      .finally(() => {
        if (!genegeerd) setLaden(false);
      });
    return () => {
      genegeerd = true;
    };
  }, [ingelogd, campagneNaam]);

  async function toevoegen() {
    const tekst = nieuw.trim();
    if (!tekst || bezigMetToevoegen) return;
    setBezigMetToevoegen(true);
    setFout(null);
    const metMetriek = vraagtOmMetriek(soort);
    try {
      const res = await fetch("/api/campagne-notities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campagne: campagneNaam,
          tekst,
          soort,
          metriek: metMetriek ? metriek : null,
          // De beginstand komt uit de sheet die nu op het scherm staat: het cijfer
          // waar het team op dat moment naar keek, niet een latere herberekening.
          metriekWaarde: metMetriek ? huidigeMetriekWaarde(campagne, metriek) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon aantekening niet opslaan.");
      const item = json.item as Notitie;
      setItems((prev) => [...(prev ?? []), item]);
      setProfielen((prev) => ({ ...prev, [item.aangemaaktDoor]: json.profiel as Profiel }));
      setNieuw("");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon aantekening niet opslaan.");
    } finally {
      setBezigMetToevoegen(false);
    }
  }

  async function opslaan(id: string) {
    const tekst = bewerkTekst.trim();
    if (!tekst) return;
    setFout(null);
    try {
      const res = await fetch(`/api/campagne-notities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon aantekening niet wijzigen.");
      setItems((prev) => (prev ?? []).map((i) => (i.id === id ? { ...i, tekst } : i)));
      setBewerkId(null);
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon aantekening niet wijzigen.");
    }
  }

  async function vinkAf(item: Notitie) {
    const afgerond = item.afgerondOp === null;
    setFout(null);
    setItems((prev) =>
      (prev ?? []).map((i) =>
        i.id === item.id ? { ...i, afgerondOp: afgerond ? new Date().toISOString() : null } : i,
      ),
    );
    try {
      const res = await fetch(`/api/campagne-notities/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ afgerond }),
      });
      if (!res.ok) throw new Error((await res.json()).fout ?? "Kon actie niet bijwerken.");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon actie niet bijwerken.");
      setItems((prev) =>
        (prev ?? []).map((i) => (i.id === item.id ? { ...i, afgerondOp: item.afgerondOp } : i)),
      );
    }
  }

  async function verwijderen(id: string) {
    setFout(null);
    try {
      const res = await fetch(`/api/campagne-notities/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout ?? "Kon aantekening niet verwijderen.");
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon aantekening niet verwijderen.");
    }
  }

  if (!ingelogd) {
    return (
      <div className="text-sm text-ink-muted">
        <p>Log in om het logboek van deze campagne te bekijken en aan te vullen.</p>
        <a
          href="/login"
          className="mt-3 inline-block rounded-button bg-primary px-4 py-1.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </div>
    );
  }

  const gekozenSoort = SOORTEN.find((s) => s.waarde === soort);
  // Nieuwste eerst: de API levert oplopend (voor het "toen → nu"-verloop), maar wie het
  // logboek opent wil eerst zien wat er laatst is vastgelegd.
  const items_nieuwNaarOud = [...(items ?? [])].reverse();

  return (
    <div className="flex flex-col gap-4">
      {fout && (
        <p className="rounded-card border border-orange bg-card px-3 py-2 text-xs text-orange">{fout}</p>
      )}

      <div className="flex flex-col gap-2">
        {/* De soort staat vóór het tekstveld: hij bepaalt wat je opschrijft, niet
            andersom. Een besluit vraagt daarna vanzelf om het cijfer eronder. */}
        <p className="label-theme text-label text-ink-faint">Nieuwe aantekening</p>
        <div className="flex flex-wrap gap-1">
          {SOORTEN.map((s) => (
            <button
              key={s.waarde}
              type="button"
              onClick={() => setSoort(s.waarde)}
              title={s.uitleg}
              className={`rounded-button px-2.5 py-1 text-xs font-medium transition-colors ${
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

        <div className="flex items-end gap-2">
          <textarea
            value={nieuw}
            onChange={(e) => setNieuw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void toevoegen();
              }
            }}
            placeholder={
              soort === "besluit"
                ? "Wat hebben we besloten?"
                : soort === "hypothese"
                  ? "Wat verwachten we, en waarom?"
                  : soort === "actie"
                    ? "Wat gaat wie doen?"
                    : "Wat zie je in de cijfers?"
            }
            rows={2}
            autoFocus
            className="w-full flex-1 resize-none rounded-control border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={toevoegen}
            disabled={!nieuw.trim() || bezigMetToevoegen}
            aria-label="Toevoegen aan logboek"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary text-on-primary transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconPlus className="h-4 w-4" />
          </button>
        </div>

        {vraagtOmMetriek(soort) && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            Welk cijfer moet hierdoor veranderen?
            <select
              value={metriek}
              onChange={(e) => setMetriek(e.target.value)}
              className="rounded-control border border-line bg-card px-2 py-1 text-xs text-ink focus:border-primary focus:outline-none"
            >
              {METRIEKEN.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="text-ink-faint tabular-nums">
              nu:{" "}
              {formatWaarde(
                huidigeMetriekWaarde(campagne, metriek),
                vindMetriek(metriek)?.eenheid ?? "aantal",
              )}
            </span>
          </label>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {laden && items === null ? (
          <p className="text-sm text-ink-faint">Laden…</p>
        ) : items_nieuwNaarOud.length === 0 ? (
          <p className="text-sm text-ink-faint">
            Nog niets vastgelegd voor deze campagne. Begin met wat je in de cijfers ziet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items_nieuwNaarOud.map((item) => {
              const profiel = profielen[item.aangemaaktDoor];
              const afgerond = item.afgerondOp !== null;
              return (
                <li key={item.id} className="flex items-start gap-2.5 rounded-card border border-line px-3 py-2">
                  <Avatar
                    naam={profiel?.naam ?? null}
                    avatarUrl={profiel?.avatarUrl ?? null}
                    size={22}
                    className="mt-0.5"
                  />
                  {bewerkId === item.id ? (
                    <div className="flex flex-1 flex-col gap-2">
                      <textarea
                        value={bewerkTekst}
                        onChange={(e) => setBewerkTekst(e.target.value)}
                        rows={2}
                        autoFocus
                        className="w-full resize-none rounded-control border border-line px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => opslaan(item.id)}
                          className="rounded-control bg-primary px-3 py-1 text-xs font-medium text-on-primary hover:bg-primary-dark"
                        >
                          Opslaan
                        </button>
                        <button
                          type="button"
                          onClick={() => setBewerkId(null)}
                          className="rounded-control px-3 py-1 text-xs font-medium text-ink-muted hover:bg-surface"
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                          <span
                            className={`label-theme rounded-control px-1.5 py-0.5 text-label ${SOORT_STIJL[item.soort]}`}
                          >
                            {SOORT_LABEL[item.soort]}
                          </span>
                          <span className="truncate font-medium">{profiel?.naam || "Onbekend"}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDatum(item.aangemaaktOp)}</span>
                        </p>
                        <p
                          className={`mt-1 whitespace-pre-wrap text-sm ${
                            afgerond ? "text-ink-faint line-through" : "text-ink"
                          }`}
                        >
                          {item.tekst}
                        </p>
                        <MetriekVerloop notitie={item} campagne={campagne} />
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {item.soort === "actie" && (
                          <button
                            type="button"
                            onClick={() => void vinkAf(item)}
                            aria-label={afgerond ? "Actie heropenen" : "Actie afvinken"}
                            title={afgerond ? "Actie heropenen" : "Actie afvinken"}
                            className={`flex h-6 w-6 items-center justify-center rounded ${
                              afgerond
                                ? "text-positive hover:bg-surface"
                                : "text-ink-faint hover:bg-surface hover:text-positive"
                            }`}
                          >
                            <IconCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setBewerkId(item.id);
                            setBewerkTekst(item.tekst);
                          }}
                          aria-label="Aantekening bewerken"
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-surface hover:text-ink"
                        >
                          <IconPencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => verwijderen(item.id)}
                          aria-label="Aantekening verwijderen"
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-surface hover:text-negative"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
