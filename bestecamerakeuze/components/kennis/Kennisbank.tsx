"use client";

import { useCallback, useEffect, useState } from "react";
import type { Kennisitem, Soort } from "@/lib/kennisbank";

/**
 * De kennisbank: wat de chat over jullie manier van werken moet weten.
 *
 * Doelgroep is de marketeer, niet de bouwer. Daarom: geen schema om in te passen, geen
 * jargon, en per soort een voorbeeld in het invoerveld zodat iemand ziet wat er wordt
 * verwacht in plaats van het te moeten raden.
 */

interface Ruimte {
  gebruikt: number;
  budget: number;
  weggelaten: number;
}

const SOORTEN: {
  waarde: Soort;
  label: string;
  uitleg: string;
  voorbeeldTitel: string;
  voorbeeldInhoud: string;
}[] = [
  {
    waarde: "koppeling",
    label: "Koppeling",
    uitleg: "Namen die bij elkaar horen — bijvoorbeeld een Ads-campagne en een mailing.",
    voorbeeldTitel: "Najaarsactie DAF 2025",
    voorbeeldInhoud:
      "De campagne 'Najaarsactie DAF 2025' bestaat uit de Google Ads-campagne " +
      "'najaar-daf-2025' en de e-mailcampagne 'Najaar DAF nieuwsbrief'. Vragen over " +
      "deze campagne gaan over beide bronnen samen.",
  },
  {
    waarde: "definitie",
    label: "Definitie",
    uitleg: "Wat een term bij jullie precies betekent.",
    voorbeeldTitel: "Wat telt als een lead",
    voorbeeldInhoud:
      "Een lead telt pas mee als het contactformulier volledig is ingevuld. " +
      "Downloads van de brochure tellen niet als lead.",
  },
  {
    waarde: "context",
    label: "Context",
    uitleg: "Achtergrond die cijfers verklaarbaar maakt.",
    voorbeeldTitel: "Bouwvak 2025",
    voorbeeldInhoud:
      "In week 30 t/m 32 lag de verkoop stil vanwege de bouwvak. Lage aantallen in " +
      "die weken zijn normaal en geen dip in de vraag.",
  },
  {
    waarde: "let_op",
    label: "Let op",
    uitleg: "Iets waar de chat rekening mee moet houden of voor moet waarschuwen.",
    voorbeeldTitel: "Campagnecodes gewijzigd",
    voorbeeldInhoud:
      "Vanaf maart 2026 gebruiken we een nieuw formaat voor campagnecodes. " +
      "Vergelijkingen over die grens heen kloppen niet zonder handmatige correctie.",
  },
];

const SOORT_KLEUR: Record<Soort, string> = {
  koppeling: "border-primary text-primary",
  definitie: "border-line text-ink-muted",
  context: "border-line text-ink-muted",
  let_op: "border-orange text-orange",
};

function leeg(soort: Soort = "koppeling") {
  return { soort, titel: "", inhoud: "", geldigVan: "", geldigTot: "", actief: true };
}

type Formulier = ReturnType<typeof leeg>;

function Formulierveld({
  formulier,
  setFormulier,
  onOpslaan,
  onAnnuleer,
  bezig,
  bestaand,
}: {
  formulier: Formulier;
  setFormulier: (f: Formulier) => void;
  onOpslaan: () => void;
  onAnnuleer: () => void;
  bezig: boolean;
  bestaand: boolean;
}) {
  const gekozen = SOORTEN.find((s) => s.waarde === formulier.soort) ?? SOORTEN[0];

  return (
    <div className="rounded-panel border border-primary bg-card p-5">
      <p className="font-sans-w7 text-base font-bold text-ink">
        {bestaand ? "Kennis aanpassen" : "Kennis toevoegen"}
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs tracking-wide text-ink-faint uppercase">
          Wat voor soort kennis is dit?
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SOORTEN.map((s) => (
            <button
              key={s.waarde}
              type="button"
              onClick={() => setFormulier({ ...formulier, soort: s.waarde })}
              className={`rounded-button border px-3.5 py-1.5 text-sm transition-colors ${
                formulier.soort === s.waarde
                  ? "border-primary bg-primary text-on-primary"
                  : "border-line bg-card text-ink hover:border-primary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-muted">{gekozen.uitleg}</p>
      </fieldset>

      <label className="mt-4 block">
        <span className="text-xs tracking-wide text-ink-faint uppercase">
          Korte naam
        </span>
        <input
          value={formulier.titel}
          onChange={(e) => setFormulier({ ...formulier, titel: e.target.value })}
          placeholder={gekozen.voorbeeldTitel}
          className="mt-1 w-full rounded-card border border-line bg-card px-4 py-2.5 text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs tracking-wide text-ink-faint uppercase">
          Wat moet de chat weten?
        </span>
        <textarea
          value={formulier.inhoud}
          onChange={(e) => setFormulier({ ...formulier, inhoud: e.target.value })}
          rows={4}
          placeholder={gekozen.voorbeeldInhoud}
          className="mt-1 w-full resize-y rounded-card border border-line bg-card px-4 py-2.5 text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
        />
        <span className="mt-1 block text-sm text-ink-muted">
          Schrijf het zoals je het aan een nieuwe collega zou uitleggen. Hele zinnen
          werken beter dan steekwoorden.
        </span>
      </label>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="block">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            Geldig vanaf <span className="normal-case">(optioneel)</span>
          </span>
          <input
            type="date"
            value={formulier.geldigVan}
            onChange={(e) => setFormulier({ ...formulier, geldigVan: e.target.value })}
            className="mt-1 block rounded-card border border-line bg-card px-3 py-2 text-ink focus:border-primary focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs tracking-wide text-ink-faint uppercase">
            Geldig tot en met <span className="normal-case">(optioneel)</span>
          </span>
          <input
            type="date"
            value={formulier.geldigTot}
            onChange={(e) => setFormulier({ ...formulier, geldigTot: e.target.value })}
            className="mt-1 block rounded-card border border-line bg-card px-3 py-2 text-ink focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpslaan}
          disabled={bezig || !formulier.titel.trim() || !formulier.inhoud.trim()}
          className="rounded-button bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark disabled:opacity-40"
        >
          {bezig ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={onAnnuleer}
          className="rounded-button border border-line bg-card px-5 py-2.5 text-sm text-ink transition-colors hover:border-primary"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

export default function Kennisbank({ ingelogd }: { ingelogd: boolean }) {
  const [items, setItems] = useState<Kennisitem[]>([]);
  const [ruimte, setRuimte] = useState<Ruimte | null>(null);
  const [formulier, setFormulier] = useState<Formulier | null>(null);
  const [bewerktId, setBewerktId] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");

  const laad = useCallback(async () => {
    const res = await fetch("/api/kennis");
    if (!res.ok) return;
    const data = (await res.json()) as { items: Kennisitem[]; ruimte: Ruimte };
    setItems(data.items);
    setRuimte(data.ruimte);
  }, []);

  useEffect(() => {
    if (ingelogd) void laad();
  }, [ingelogd, laad]);

  async function opslaan() {
    if (!formulier) return;
    setBezig(true);
    setFout(null);
    const body = {
      soort: formulier.soort,
      titel: formulier.titel,
      inhoud: formulier.inhoud,
      geldigVan: formulier.geldigVan,
      geldigTot: formulier.geldigTot,
      actief: formulier.actief,
    };
    const res = await fetch(bewerktId ? `/api/kennis/${bewerktId}` : "/api/kennis", {
      method: bewerktId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBezig(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { fout?: string };
      setFout(j.fout ?? "Opslaan mislukt.");
      return;
    }
    setFormulier(null);
    setBewerktId(null);
    await laad();
  }

  async function zetActief(item: Kennisitem, actief: boolean) {
    setItems((l) => l.map((i) => (i.id === item.id ? { ...i, actief } : i)));
    await fetch(`/api/kennis/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actief }),
    });
    await laad();
  }

  async function verwijder(item: Kennisitem) {
    if (!confirm(`"${item.titel}" verwijderen?`)) return;
    setItems((l) => l.filter((i) => i.id !== item.id));
    await fetch(`/api/kennis/${item.id}`, { method: "DELETE" });
    await laad();
  }

  function bewerk(item: Kennisitem) {
    setBewerktId(item.id);
    setFormulier({
      soort: item.soort,
      titel: item.titel,
      inhoud: item.inhoud,
      geldigVan: item.geldigVan ?? "",
      geldigTot: item.geldigTot ?? "",
      actief: item.actief,
    });
  }

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">
          Log in om de kennisbank te beheren
        </p>
        <a
          href="/login"
          className="mt-5 inline-block rounded-button bg-primary px-5 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </div>
    );
  }

  const zichtbaar = zoek.trim()
    ? items.filter((i) =>
        `${i.titel} ${i.inhoud}`.toLowerCase().includes(zoek.trim().toLowerCase()),
      )
    : items;
  const bijnaVol = ruimte ? ruimte.gebruikt > ruimte.budget * 0.8 : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-panel border border-line bg-surface p-6">
        <p className="font-sans-w7 text-base font-bold text-ink">
          Wat de chat over jullie werk moet weten
        </p>
        <p className="mt-1.5 max-w-3xl text-sm text-ink-muted">
          De chat kent de cijfers, maar niet jullie afspraken. Dat een Google
          Ads-campagne en een mailing samen één campagne zijn, staat nergens in de data —
          hier leg je dat vast. Alles wat hieronder staat, leest de chat mee bij elke
          vraag. Je kunt het altijd aanpassen of weghalen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!formulier && (
          <button
            type="button"
            onClick={() => {
              setBewerktId(null);
              setFormulier(leeg());
            }}
            className="rounded-button bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
          >
            Kennis toevoegen
          </button>
        )}
        <input
          type="search"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoeken"
          className="min-w-[200px] flex-1 rounded-button border border-line bg-card px-4 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
        />
        <span className="text-sm text-ink-faint">
          {items.filter((i) => i.actief).length} actief van {items.length}
        </span>
      </div>

      {fout && (
        <p className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-orange">
          {fout}
        </p>
      )}

      {bijnaVol && ruimte && (
        <p className="rounded-card border border-orange bg-card px-4 py-3 text-sm text-ink">
          De kennisbank is bijna vol ({Math.round((ruimte.gebruikt / ruimte.budget) * 100)}
          % van de ruimte die de chat kan meelezen).
          {ruimte.weggelaten > 0 &&
            ` ${ruimte.weggelaten} ${ruimte.weggelaten === 1 ? "item wordt" : "items worden"} nu niet meegelezen.`}{" "}
          Zet items die niet meer gelden op inactief, dan komt er ruimte vrij.
        </p>
      )}

      {formulier && (
        <Formulierveld
          formulier={formulier}
          setFormulier={setFormulier}
          onOpslaan={() => void opslaan()}
          onAnnuleer={() => {
            setFormulier(null);
            setBewerktId(null);
            setFout(null);
          }}
          bezig={bezig}
          bestaand={Boolean(bewerktId)}
        />
      )}

      {/* Terwijl het formulier openstaat is de lege-staat pure herhaling: dezelfde
          voorbeelden staan dan al als voorbeeldtekst in de invoervelden. */}
      {zichtbaar.length === 0 && formulier ? null : zichtbaar.length === 0 ? (
        <div className="rounded-panel border border-line bg-card p-8">
          <p className="font-sans-w7 text-base font-bold text-ink">
            {zoek ? "Niets gevonden" : "Nog geen kennis vastgelegd"}
          </p>
          {!zoek && (
            <>
              <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">
                Begin met de dingen waar de chat het vaakst naast zou zitten. Bijvoorbeeld:
              </p>
              <ul className="mt-3 flex max-w-2xl flex-col gap-2 text-sm text-ink">
                {SOORTEN.map((s) => (
                  <li key={s.waarde} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange"
                    />
                    <span>
                      <strong className="font-sans-w7 font-semibold">{s.label}:</strong>{" "}
                      {s.voorbeeldTitel} — {s.voorbeeldInhoud}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {zichtbaar.map((item) => (
            <li
              key={item.id}
              className={`rounded-panel border border-line bg-card p-5 ${
                item.actief ? "" : "opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-button border px-2.5 py-0.5 text-xs ${SOORT_KLEUR[item.soort]}`}
                    >
                      {SOORTEN.find((s) => s.waarde === item.soort)?.label ?? item.soort}
                    </span>
                    <span className="font-sans-w7 font-bold text-ink">{item.titel}</span>
                    {!item.actief && (
                      <span className="text-xs text-ink-faint">— staat uit</span>
                    )}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap text-ink">
                    {item.inhoud}
                  </p>
                  {(item.geldigVan || item.geldigTot) && (
                    <p className="mt-2 text-xs text-ink-faint">
                      Geldig{item.geldigVan ? ` vanaf ${item.geldigVan}` : ""}
                      {item.geldigTot ? ` tot en met ${item.geldigTot}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => bewerk(item)}
                    className="rounded-button border border-line bg-card px-3 py-1 text-xs text-ink-muted transition-colors hover:border-primary hover:text-ink"
                  >
                    Aanpassen
                  </button>
                  <button
                    type="button"
                    onClick={() => void zetActief(item, !item.actief)}
                    className="rounded-button border border-line bg-card px-3 py-1 text-xs text-ink-muted transition-colors hover:border-primary hover:text-ink"
                  >
                    {item.actief ? "Uitzetten" : "Aanzetten"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void verwijder(item)}
                    className="rounded-button border border-line bg-card px-3 py-1 text-xs text-ink-muted transition-colors hover:border-orange hover:text-orange"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
