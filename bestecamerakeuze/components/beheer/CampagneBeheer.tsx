"use client";

import { useMemo, type ReactNode } from "react";
import type { Campagne } from "@/lib/sheet";
import BewerkbaarVeld from "@/components/BewerkbaarVeld";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { useCampagneFilters } from "@/lib/campagneFilterContext";

type Kolom = {
  label: string;
  veld: keyof Campagne & string;
  type?: "getal" | "tekst";
  huidigeWaarde: (c: Campagne) => string;
  render: (c: Campagne) => ReactNode;
};

/**
 * Dezelfde velden als het "Nieuwe campagne"-formulier (zie NieuweCampagneModal), min de
 * naam die als sticky eerste kolom apart staat. Leads, Online leads, Orders en Status
 * blijven hier bewust weg — die komen ergens anders vandaan en zijn ook in de
 * campagnetabel nooit bewerkbaar (zie CLAUDE.md).
 */
const KOLOMMEN: Kolom[] = [
  {
    label: "Merk",
    veld: "merk",
    huidigeWaarde: (c) => c.merk,
    render: (c) => c.merk || "—",
  },
  {
    label: "Model",
    veld: "model",
    huidigeWaarde: (c) => c.model,
    render: (c) => c.model || "—",
  },
  {
    label: "Budget",
    veld: "budget",
    type: "getal",
    huidigeWaarde: (c) => (c.budget !== null ? String(c.budget) : ""),
    render: (c) => formatCurrency(c.budget),
  },
  {
    label: "Uitgaven",
    veld: "uitgaven",
    type: "getal",
    huidigeWaarde: (c) => (c.uitgaven !== null ? String(c.uitgaven) : ""),
    render: (c) => formatCurrency(c.uitgaven),
  },
  {
    label: "Doel leads",
    veld: "doelLeads",
    type: "getal",
    huidigeWaarde: (c) => (c.doelLeads !== null ? String(c.doelLeads) : ""),
    render: (c) => formatNumber(c.doelLeads),
  },
  {
    label: "Doel orders",
    veld: "doelOrders",
    type: "getal",
    huidigeWaarde: (c) => (c.doelOrders !== null ? String(c.doelOrders) : ""),
    render: (c) => formatNumber(c.doelOrders),
  },
  {
    label: "Startdatum",
    veld: "startdatum",
    huidigeWaarde: (c) => c.startdatum ?? "",
    render: (c) => formatDate(c.startdatum),
  },
  {
    label: "Einddatum",
    veld: "einddatum",
    huidigeWaarde: (c) => c.einddatum ?? "",
    render: (c) => formatDate(c.einddatum),
  },
  {
    label: "Lead type",
    veld: "leadType",
    huidigeWaarde: (c) => c.leadType,
    render: (c) => c.leadType || "—",
  },
  {
    label: "Ordersoort",
    veld: "ordersoort",
    huidigeWaarde: (c) => c.ordersoort,
    render: (c) => c.ordersoort || "—",
  },
  {
    // Kolomkop in de sheet is "Klantgroep orders (indien van toepassing)"; hier
    // afgekort zoals ook al in de filterbalk gebeurt (CampagneFilterBalk.tsx).
    label: "Klantgroep orders",
    veld: "klantgroepOrders",
    huidigeWaarde: (c) => c.klantgroepOrders,
    render: (c) => c.klantgroepOrders || "—",
  },
];

type Props = {
  ingelogd: boolean;
};

/**
 * Beheeroverzicht van alle campagnes: één rij per campagne, alle velden uit het
 * "Nieuwe campagne"-formulier bewerkbaar in-place — precies de velden die ook in de
 * sheet staan. Elke wijziging gaat via hetzelfde schrijf-endpoint als de bewerkbare
 * cellen in het tabblad Campagnes (`/api/campagnes/veld`), dus dit blijft altijd in
 * sync met de sheet: de sheet is en blijft de bron (zie CLAUDE.md).
 */
export default function CampagneBeheer({ ingelogd }: Props) {
  const { campagnes } = useCampagneFilters();

  const gesorteerd = useMemo(
    () => [...campagnes].sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    [campagnes],
  );

  if (!ingelogd) {
    return (
      <div className="rounded-panel border border-line bg-surface p-8 text-center">
        <p className="font-sans-w7 text-lg font-bold text-ink">Log in om campagnes te beheren</p>
        <p className="mt-2 text-sm text-ink-muted">
          Campagnes toevoegen en velden bewerken schrijft rechtstreeks terug naar de sheet.
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

  if (gesorteerd.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-card px-6 py-10 text-center shadow-card">
        <p className="text-sm text-ink-muted">
          Nog geen campagnes. Gebruik het &quot;+&quot;-knopje rechtsonder om er een toe te
          voegen.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col className="w-[200px]" />
            {KOLOMMEN.map((kolom) => (
              <col key={kolom.veld} className="w-[150px]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="label-theme sticky left-0 top-0 z-20 border-b border-r border-line bg-card px-4 py-3 text-label text-ink-faint"
              >
                Campagne naam
              </th>
              {KOLOMMEN.map((kolom) => (
                <th
                  key={kolom.veld}
                  scope="col"
                  className="label-theme sticky top-0 z-10 border-b border-line bg-card px-3 py-3 text-label text-ink-faint"
                >
                  {kolom.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((campagne) => (
              <tr key={campagne.naam}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-line-soft bg-card px-4 py-3 text-left align-top text-sm font-medium text-ink"
                >
                  <BewerkbaarVeld campagneNaam={campagne.naam} veld="naam" initieleWaarde={campagne.naam}>
                    {campagne.naam}
                  </BewerkbaarVeld>
                </th>
                {KOLOMMEN.map((kolom) => (
                  <td key={kolom.veld} className="border-b border-line-soft px-3 py-3 align-top text-sm text-ink">
                    <BewerkbaarVeld
                      campagneNaam={campagne.naam}
                      veld={kolom.veld}
                      initieleWaarde={kolom.huidigeWaarde(campagne)}
                      type={kolom.type}
                    >
                      {kolom.render(campagne)}
                    </BewerkbaarVeld>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
