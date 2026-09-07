"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

type Props = {
  campagneNaam: string;
  veld: string;
  /** De waarde zoals die terug de sheet in moet, niet de opgemaakte weergavewaarde. */
  initieleWaarde: string;
  type?: "getal" | "tekst";
  children: ReactNode;
};

/**
 * Normaliseert een getal-invoer naar de NL-notatie (komma als decimaal) waarin de
 * sheet zelf ook getallen verwacht, ongeacht of iemand een punt of komma typte.
 * Lege invoer is toegestaan (maakt de cel leeg).
 */
function normaliseerGetal(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return "";
  const numeriek = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(numeriek)) return null;
  return numeriek.toString().replace(".", ",");
}

/**
 * Klik-om-te-bewerken cel: toont normaal de bestaande weergave (`children`), en
 * verandert die bij een klik in een invoerveld. Opslaan gaat via het write-endpoint
 * naar de sheet; bij succes ververst `router.refresh()` de servergegevens, net als de
 * bestaande "Data updaten"-knop.
 */
export default function BewerkbaarVeld({ campagneNaam, veld, initieleWaarde, type = "tekst", children }: Props) {
  const router = useRouter();
  const [bewerken, setBewerken] = useState(false);
  const [waarde, setWaarde] = useState(initieleWaarde);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  function beginBewerken() {
    setWaarde(initieleWaarde);
    setFout(null);
    setBewerken(true);
  }

  async function opslaan() {
    if (bezig) return;
    if (waarde === initieleWaarde) {
      setBewerken(false);
      return;
    }

    const teVersturen = type === "getal" ? normaliseerGetal(waarde) : waarde.trim();
    if (teVersturen === null) {
      setFout("Voer een geldig getal in.");
      return;
    }

    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/campagnes/veld", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campagne: campagneNaam, veld, waarde: teVersturen }),
      });
      const data = (await res.json().catch(() => ({}))) as { fout?: string };
      if (!res.ok) throw new Error(data.fout ?? "Opslaan mislukt.");
      setBewerken(false);
      router.refresh();
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  }

  if (!bewerken) {
    return (
      <button
        type="button"
        onClick={beginBewerken}
        title="Klik om te bewerken"
        className="block w-full rounded-control text-left decoration-line-soft decoration-dotted underline-offset-4 hover:underline"
      >
        {children}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        type="text"
        inputMode={type === "getal" ? "decimal" : "text"}
        value={waarde}
        disabled={bezig}
        onChange={(e) => setWaarde(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
          if (e.key === "Escape") setBewerken(false);
        }}
        onBlur={opslaan}
        className="w-full rounded-control border border-line bg-card px-2 py-1 text-sm tabular-nums text-ink outline-none focus:border-primary disabled:opacity-60"
      />
      {fout && <span className="text-xs text-negative">{fout}</span>}
    </div>
  );
}
