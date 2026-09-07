"use client";

import { useMemo, useState } from "react";
import type { Campagne } from "@/lib/sheet";
import { useCampagneFilters } from "@/lib/campagneFilterContext";
import { normaliseerGetal } from "@/lib/getallen";
import Modal from "@/components/Modal";

type Props = {
  ingelogd: boolean;
  onClose: () => void;
};

type FormVeld =
  | "naam"
  | "budget"
  | "uitgaven"
  | "doelLeads"
  | "doelOrders"
  | "startdatum"
  | "einddatum"
  | "merk"
  | "model"
  | "leadType"
  | "ordersoort"
  | "klantgroepOrders";

const LEGE_FORM: Record<FormVeld, string> = {
  naam: "",
  budget: "",
  uitgaven: "",
  doelLeads: "",
  doelOrders: "",
  startdatum: "",
  einddatum: "",
  merk: "",
  model: "",
  leadType: "",
  ordersoort: "",
  klantgroepOrders: "",
};

const GETALVELDEN: FormVeld[] = ["budget", "uitgaven", "doelLeads", "doelOrders"];

/** Alle velden van het formulier, in dezelfde volgorde als de JSX — gebruikt om te
 * controleren dat niets leeg is gebleven vóór het opslaan. */
const ALLE_VELDEN: FormVeld[] = [
  "naam",
  "budget",
  "uitgaven",
  "doelLeads",
  "doelOrders",
  "startdatum",
  "einddatum",
  "merk",
  "model",
  "leadType",
  "ordersoort",
  "klantgroepOrders",
];

/** Kolomkoppen exact zoals in de sheet, zodat het formulier één op één aansluit. */
const VELD_LABELS: Record<FormVeld, string> = {
  naam: "Campagne naam",
  budget: "Budget",
  uitgaven: "Uitgaven",
  doelLeads: "Doel leads",
  doelOrders: "Doel orders",
  startdatum: "Startdatum",
  einddatum: "Einddatum",
  merk: "Merk",
  model: "Model",
  leadType: "Lead type",
  ordersoort: "Ordersoort",
  klantgroepOrders: "Klantgroep orders (indien van toepassing)",
};

function unieekGesorteerd(waarden: string[]): string[] {
  return Array.from(new Set(waarden.map((w) => w.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "nl"),
  );
}

/** Getal-invoer (na normalisatie naar NL-notatie) terug naar een number voor de lokale kopie. */
function naarGetal(waarde: string): number | null {
  if (waarde === "") return null;
  const parsed = Number(waarde.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Formulier voor een nieuwe campagne, in een Modal. De velden komen exact overeen met de
 * kolommen in de sheet (zie CLAUDE.md: de sheet blijft de bron). Bij opslaan gaat de rij
 * naar `/api/campagnes/nieuw`, dat hem in de eerste lege rij van het tabblad "Campagnes"
 * zet; bij succes komt de nieuwe campagne ook meteen in de lokale kopie (`voegCampagneToe`)
 * zodat hij zonder serverrefresh zichtbaar is in de tabel, de tijdlijn en het beheer.
 */
export default function NieuweCampagneModal({ ingelogd, onClose }: Props) {
  const { campagnes, voegCampagneToe } = useCampagneFilters();
  const [form, setForm] = useState<Record<FormVeld, string>>(LEGE_FORM);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const suggesties = useMemo(
    () => ({
      merk: unieekGesorteerd(campagnes.map((c) => c.merk)),
      model: unieekGesorteerd(campagnes.map((c) => c.model)),
      leadType: unieekGesorteerd(campagnes.map((c) => c.leadType)),
      ordersoort: unieekGesorteerd(campagnes.map((c) => c.ordersoort)),
      klantgroepOrders: unieekGesorteerd(campagnes.map((c) => c.klantgroepOrders)),
    }),
    [campagnes],
  );

  function setVeld(veld: FormVeld, waarde: string) {
    setForm((huidig) => ({ ...huidig, [veld]: waarde }));
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (bezig) return;

    const ontbrekendVeld = ALLE_VELDEN.find((veld) => !form[veld].trim());
    if (ontbrekendVeld) {
      setFout(`"${VELD_LABELS[ontbrekendVeld]}" is verplicht.`);
      return;
    }

    const naam = form.naam.trim();
    const genormaliseerd: Record<FormVeld, string> = { ...form, naam };
    for (const veld of GETALVELDEN) {
      const genorm = normaliseerGetal(form[veld]);
      if (genorm === null) {
        setFout(`Voer een geldig getal in bij "${VELD_LABELS[veld]}".`);
        return;
      }
      genormaliseerd[veld] = genorm;
    }

    setBezig(true);
    setFout(null);
    try {
      const res = await fetch("/api/campagnes/nieuw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genormaliseerd),
      });
      const data = (await res.json().catch(() => ({}))) as { fout?: string };
      if (!res.ok) throw new Error(data.fout ?? "Kon de campagne niet opslaan.");

      const nieuweCampagne: Campagne = {
        naam,
        budget: naarGetal(genormaliseerd.budget),
        uitgaven: naarGetal(genormaliseerd.uitgaven),
        doelLeads: naarGetal(genormaliseerd.doelLeads),
        doelOrders: naarGetal(genormaliseerd.doelOrders),
        startdatum: form.startdatum || null,
        einddatum: form.einddatum || null,
        status: "",
        orderTotaal: null,
        ordersCampagne: null,
        leads: null,
        leadsMarketing: null,
        resultaat: "",
        merk: form.merk.trim(),
        model: form.model.trim(),
        leadType: form.leadType.trim(),
        ordersoort: form.ordersoort.trim(),
        klantgroepOrders: form.klantgroepOrders.trim(),
        doelLeadsMarketing: null,
        doelOrdersMarketing: null,
        campagnepagina: "",
        definitieLead: "",
      };
      voegCampagneToe(nieuweCampagne);
      onClose();
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Kon de campagne niet opslaan.");
    } finally {
      setBezig(false);
    }
  }

  if (!ingelogd) {
    return (
      <Modal title="Nieuwe campagne" onClose={onClose}>
        <p className="text-sm text-ink-muted">Log in om een nieuwe campagne toe te voegen.</p>
        <a
          href="/login"
          className="mt-4 inline-block rounded-button bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dark"
        >
          Inloggen
        </a>
      </Modal>
    );
  }

  const tekstveld = (veld: FormVeld, opties?: string[]) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {VELD_LABELS[veld]}
      </span>
      <input
        type="text"
        list={opties ? `${veld}-opties` : undefined}
        value={form[veld]}
        disabled={bezig}
        required
        onChange={(e) => setVeld(veld, e.target.value)}
        className="rounded-control border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
      />
      {opties && (
        <datalist id={`${veld}-opties`}>
          {opties.map((optie) => (
            <option key={optie} value={optie} />
          ))}
        </datalist>
      )}
    </label>
  );

  const getalveld = (veld: FormVeld) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {VELD_LABELS[veld]}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={form[veld]}
        disabled={bezig}
        required
        onChange={(e) => setVeld(veld, e.target.value)}
        className="rounded-control border border-line bg-card px-3 py-2 text-sm tabular-nums text-ink outline-none focus:border-primary disabled:opacity-60"
      />
    </label>
  );

  const datumveld = (veld: FormVeld) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {VELD_LABELS[veld]}
      </span>
      <input
        type="date"
        value={form[veld]}
        disabled={bezig}
        required
        onChange={(e) => setVeld(veld, e.target.value)}
        className="rounded-control border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
      />
    </label>
  );

  return (
    <Modal title="Nieuwe campagne" onClose={onClose}>
      <form onSubmit={opslaan} className="flex flex-col gap-3">
        {tekstveld("naam")}
        <div className="grid grid-cols-2 gap-3">
          {getalveld("budget")}
          {getalveld("uitgaven")}
          {getalveld("doelLeads")}
          {getalveld("doelOrders")}
          {datumveld("startdatum")}
          {datumveld("einddatum")}
        </div>
        {tekstveld("merk", suggesties.merk)}
        {tekstveld("model", suggesties.model)}
        <div className="grid grid-cols-2 gap-3">
          {tekstveld("leadType", suggesties.leadType)}
          {tekstveld("ordersoort", suggesties.ordersoort)}
        </div>
        {tekstveld("klantgroepOrders", suggesties.klantgroepOrders)}

        {fout && <p className="text-sm text-negative">{fout}</p>}

        <div className="mt-2 flex justify-end gap-2">
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
            {bezig ? "Opslaan…" : "Campagne toevoegen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
