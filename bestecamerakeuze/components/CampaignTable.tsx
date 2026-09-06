import { Fragment, type ReactNode } from "react";
import type { Campagne } from "@/lib/sheet";
import {
  deviationFromTarget,
  formatCurrency,
  formatDate,
  formatNumber,
  percentOfTarget,
  ratio,
} from "@/lib/format";
import CampaignHeader from "@/components/CampaignHeader";
import MetricCell, { PlainCell } from "@/components/MetricCell";

type Metric = {
  label: string;
  render: (campagne: Campagne) => ReactNode;
};

type Group = {
  title: string;
  metrics: Metric[];
};

/**
 * Volgorde bewust: PLANNING → BUDGET → LEADS → ORDERS. Leads vóór orders, want orders
 * is de laatste stap van de funnel.
 */
const GROUPS: Group[] = [
  {
    title: "Planning",
    metrics: [
      { label: "Startdatum", render: (c) => <PlainCell value={formatDate(c.startdatum)} /> },
      { label: "Einddatum", render: (c) => <PlainCell value={formatDate(c.einddatum)} /> },
    ],
  },
  {
    title: "Budget",
    metrics: [
      {
        label: "Budget",
        render: (c) => {
          const percent = ratio(c.uitgaven, c.budget);
          return (
            <MetricCell
              primary={formatCurrency(c.budget)}
              secondary={percent !== null ? `${Math.round(percent)}% benut` : undefined}
              progress={percent ?? undefined}
            />
          );
        },
      },
    ],
  },
  {
    title: "Leads",
    metrics: [
      { label: "Doel leads", render: (c) => <PlainCell value={formatNumber(c.doelLeads)} /> },
      {
        label: "Leads",
        render: (c) => {
          const percent = ratio(c.leads, c.doelLeads);
          return (
            <MetricCell
              primary={formatNumber(c.leads)}
              secondary={percentOfTarget(c.leads, c.doelLeads) ?? undefined}
              progress={percent ?? undefined}
            />
          );
        },
      },
      {
        label: "Online leads",
        render: (c) => <PlainCell value={formatNumber(c.leadsMarketing)} />,
      },
    ],
  },
  {
    title: "Orders",
    metrics: [
      { label: "Doel orders", render: (c) => <PlainCell value={formatNumber(c.doelOrders)} /> },
      {
        label: "Orders",
        render: (c) => {
          const deviation = deviationFromTarget(c.orderTotaal, c.doelOrders);
          return (
            <MetricCell
              primary={formatNumber(c.orderTotaal)}
              secondary={deviation?.text}
              tone={deviation?.tone}
            />
          );
        },
      },
    ],
  },
];

type Props = {
  campagnes: Campagne[];
  notitiesBeschikbaar: boolean;
  ingelogd: boolean;
};

export default function CampaignTable({ campagnes, notitiesBeschikbaar, ingelogd }: Props) {
  if (campagnes.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-card px-6 py-10 text-center shadow-card">
        <p className="text-sm text-ink-muted">Geen campagnes gevonden voor deze filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-card shadow-card">
      <div className="overflow-x-auto">
        {/* Geen vaste hoogte / verticaal scrollen hier: de tabel groeit gewoon mee met het
            aantal rijen en de pagina zelf scrollt. Alleen horizontaal scrollen (bij veel
            campagnes) blijft binnen de tabel, met border-separate (i.p.v. collapse) nodig
            zodat de sticky kolom en header niet doorschijnend worden tijdens het scrollen —
            een bekende Chromium-eigenaardigheid met sticky cellen in een border-collapse tabel. */}
        <table className="w-full table-fixed border-separate border-spacing-0 text-left">
          <colgroup>
            <col className="w-[148px]" />
            {campagnes.map((c) => (
              <col key={c.naam} className="w-[156px]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="label-theme sticky left-0 top-0 z-30 border-b border-r border-line bg-card px-4 py-3 text-label text-ink-faint"
              >
                Campagne
              </th>
              {campagnes.map((c) => (
                <th
                  key={c.naam}
                  scope="col"
                  className="sticky top-0 z-20 border-b border-line bg-card px-3 py-3 align-top"
                >
                  <CampaignHeader
                    campagne={c}
                    notitiesBeschikbaar={notitiesBeschikbaar}
                    ingelogd={ingelogd}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <Fragment key={group.title}>
                <tr>
                  <th
                    scope="colgroup"
                    className="label-theme sticky left-0 z-10 border-b border-line-soft bg-surface-tint px-4 py-1.5 text-left text-label text-ink-faint"
                  >
                    {group.title}
                  </th>
                  {campagnes.map((_, i) => (
                    <td key={i} className="border-b border-line-soft bg-surface-tint" />
                  ))}
                </tr>
                {group.metrics.map((metric) => (
                  <tr key={metric.label}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line-soft bg-card px-4 py-3 text-left text-sm font-medium text-ink-muted"
                    >
                      {metric.label}
                    </th>
                    {campagnes.map((c) => (
                      <td key={c.naam} className="border-b border-line-soft px-3 py-3 align-top">
                        {metric.render(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
