"use client";

import { useEffect } from "react";
import NotitieLijst from "@/components/notities/NotitieLijst";
import ProgressBar from "@/components/ProgressBar";
import StatusIndicator from "@/components/StatusIndicator";
import { getBrandLogo } from "@/components/brandLogos";
import { IconClose } from "@/components/icons";
import {
  deviationFromTarget,
  formatCurrency,
  formatDate,
  formatNumber,
  percentOfTarget,
  ratio,
} from "@/lib/format";
import type { Campagne } from "@/lib/sheet";

/**
 * Focusmodus: alles over één campagne op één plek.
 *
 * Het weekoverleg gaat per campagne, niet per metric — dus zodra iemand op een
 * campagnenaam klikt treedt de rest van de tabel terug en verschijnt hier het volledige
 * beeld: de kerncijfers groot, de kenmerken uit de sheet eronder en rechts het logboek,
 * zodat wat er besproken wordt meteen vastgelegd kan worden zonder een pop-up te openen.
 */

type Props = {
  campagne: Campagne;
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
  onSluit: () => void;
};

function Kerncijfer({
  label,
  waarde,
  onder,
  toon = "neutraal",
  voortgang,
}: {
  label: string;
  waarde: string;
  onder?: string;
  toon?: "neutraal" | "positief" | "negatief";
  voortgang?: number;
}) {
  const kleur =
    toon === "positief" ? "text-positive" : toon === "negatief" ? "text-negative" : "text-ink-faint";
  return (
    <div className="rounded-card border border-line px-4 py-3">
      <p className="label-theme text-label text-ink-faint">{label}</p>
      <p className="mt-1 font-sans-w7 text-title font-bold tabular-nums text-ink">{waarde}</p>
      {onder && <p className={`mt-0.5 text-xs ${kleur}`}>{onder}</p>}
      {voortgang !== undefined && (
        <div className="mt-2">
          <ProgressBar percent={voortgang} />
        </div>
      )}
    </div>
  );
}

function Kenmerk({ label, waarde }: { label: string; waarde: string }) {
  if (!waarde) return null;
  return (
    <div className="min-w-0">
      <dt className="label-theme text-label text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{waarde}</dd>
    </div>
  );
}

export default function CampagneFocus({
  campagne,
  notitiesBeschikbaar,
  ingelogd,
  onSluit,
}: Props) {
  // Escape sluit de focus — dezelfde reflex als bij een pop-up.
  useEffect(() => {
    function bijToets(event: KeyboardEvent) {
      if (event.key === "Escape") onSluit();
    }
    document.addEventListener("keydown", bijToets);
    return () => document.removeEventListener("keydown", bijToets);
  }, [onSluit]);

  const BrandLogo = campagne.merk ? getBrandLogo(campagne.merk) : null;
  const budgetBenut = ratio(campagne.uitgaven, campagne.budget);
  const leadsVoortgang = ratio(campagne.leads, campagne.doelLeads);
  const orderAfwijking = deviationFromTarget(campagne.orderTotaal, campagne.doelOrders);

  return (
    <section
      aria-label={`Focus op ${campagne.naam}`}
      className="rounded-panel border border-line bg-card p-6 shadow-card"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {BrandLogo && (
            <BrandLogo role="img" aria-label={campagne.merk} className="h-5 w-5 shrink-0 text-ink-muted" />
          )}
          <div className="min-w-0">
            <h2 className="titel-theme truncate font-sans-w7 text-title font-bold text-ink">
              {campagne.naam}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
              <StatusIndicator status={campagne.status} />
              <span>
                {formatDate(campagne.startdatum)} — {formatDate(campagne.einddatum)}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSluit}
          className="flex items-center gap-1.5 rounded-button border border-line px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-primary hover:text-ink"
        >
          <IconClose className="h-3.5 w-3.5" />
          Focus verlaten
        </button>
      </header>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_380px] gap-6">
        <div className="min-w-0">
          <div className="grid grid-cols-4 gap-3">
            <Kerncijfer
              label="Budget"
              waarde={formatCurrency(campagne.budget)}
              onder={budgetBenut !== null ? `${Math.round(budgetBenut)}% benut` : undefined}
              voortgang={budgetBenut ?? undefined}
            />
            <Kerncijfer
              label="Leads totaal"
              waarde={formatNumber(campagne.leads)}
              onder={percentOfTarget(campagne.leads, campagne.doelLeads) ?? undefined}
              voortgang={leadsVoortgang ?? undefined}
            />
            <Kerncijfer label="Leads online" waarde={formatNumber(campagne.leadsMarketing)} />
            <Kerncijfer
              label="Orders totaal"
              waarde={formatNumber(campagne.orderTotaal)}
              onder={orderAfwijking?.text}
              toon={
                orderAfwijking?.tone === "positive"
                  ? "positief"
                  : orderAfwijking?.tone === "negative"
                    ? "negatief"
                    : "neutraal"
              }
            />
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line-soft pt-5">
            <Kenmerk label="Merk" waarde={campagne.merk} />
            <Kenmerk label="Model" waarde={campagne.model} />
            <Kenmerk label="Lead type" waarde={campagne.leadType} />
            <Kenmerk label="Ordersoort" waarde={campagne.ordersoort} />
            <Kenmerk label="Klantgroep" waarde={campagne.klantgroepOrders} />
            <Kenmerk label="Doel leads online" waarde={formatNumber(campagne.doelLeads)} />
            <Kenmerk label="Doel orders totaal" waarde={formatNumber(campagne.doelOrders)} />
            <Kenmerk label="Uitgaven" waarde={formatCurrency(campagne.uitgaven)} />
            <Kenmerk label="Resultaat" waarde={campagne.resultaat} />
          </dl>

          {campagne.definitieLead && (
            <p className="mt-5 rounded-card border border-line-soft bg-surface px-4 py-3 text-sm text-ink-muted">
              <span className="label-theme mr-2 text-label text-ink-faint">Definitie lead</span>
              {campagne.definitieLead}
            </p>
          )}

          {campagne.campagnepagina && (
            <a
              href={campagne.campagnepagina}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Campagnepagina openen
            </a>
          )}
        </div>

        <div className="min-w-0 border-l border-line-soft pl-6">
          <p className="label-theme mb-3 text-label text-ink-faint">Logboek</p>
          {notitiesBeschikbaar ? (
            <NotitieLijst campagne={campagne} ingelogd={ingelogd} />
          ) : (
            <p className="text-sm text-ink-faint">
              Het logboek heeft een database nodig; die is hier niet geconfigureerd.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
