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
  /** Eén zin in gewone taal: wat staat hier, en waar moet je op letten? Zie "Zo lees je dit". */
  uitleg: string;
  render: (campagne: Campagne) => ReactNode;
};

type Group = {
  title: string;
  metrics: Metric[];
};

/**
 * Volgorde bewust: PLANNING → BUDGET → LEADS → ORDERS. Leads vóór orders, want orders
 * is de laatste stap van de funnel.
 *
 * Elke metric draagt zijn eigen uitleg mee. Die staat hier en niet in een los
 * documentje, omdat een uitleg die naast het cijfer staat gelezen wordt en een uitleg
 * in een handleiding niet — en omdat een nieuwe rij anders stilletjes zonder uitleg
 * blijft staan.
 */
const GROUPS: Group[] = [
  {
    title: "Planning",
    metrics: [
      {
        label: "Startdatum",
        uitleg: "Vanaf deze dag loopt de campagne. Alles hieronder telt vanaf dat moment.",
        render: (c) => <PlainCell value={formatDate(c.startdatum)} />,
      },
      {
        label: "Einddatum",
        uitleg:
          "Tot deze dag loopt de campagne. Een campagne die nog loopt heeft logischerwijs nog niet zijn hele doel gehaald.",
        render: (c) => <PlainCell value={formatDate(c.einddatum)} />,
      },
    ],
  },
  {
    title: "Budget",
    metrics: [
      {
        label: "Budget",
        uitleg:
          "Het afgesproken mediabudget. Eronder staat hoeveel daarvan is uitgegeven — vergelijk dat met hoever de campagne in de tijd is.",
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
      {
        label: "Doel leads",
        uitleg: "Het aantal leads dat vooraf is afgesproken voor de hele looptijd.",
        render: (c) => <PlainCell value={formatNumber(c.doelLeads)} />,
      },
      {
        label: "Leads",
        uitleg:
          "Alle leads uit deze campagne, ook die via showroom of telefoon. Eronder: hoeveel procent van het doel al binnen is.",
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
        uitleg:
          "Het deel van de leads dat online binnenkwam (kolom “Leads marketing” in de sheet) — het stuk waar de campagne zelf direct op stuurt.",
        render: (c) => <PlainCell value={formatNumber(c.leadsMarketing)} />,
      },
    ],
  },
  {
    title: "Orders",
    metrics: [
      {
        label: "Doel orders",
        uitleg: "Het aantal orders dat vooraf is afgesproken voor de hele looptijd.",
        render: (c) => <PlainCell value={formatNumber(c.doelOrders)} />,
      },
      {
        label: "Orders",
        uitleg:
          "Getekende orders. Let op: in de sheet staat hier soms een totaal over alle campagnes in plaats van een cijfer per campagne — een bedrag dat te mooi is om waar te zijn, is dat hier meestal ook.",
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
  /** Naam van de campagne in focus; de andere kolommen worden gedempt. */
  focus: string | null;
  onFocus: (naam: string | null) => void;
  /** "Zo lees je dit": zet onder elk metriclabel een zin in gewone taal. */
  uitlegAan: boolean;
};

export default function CampaignTable({
  campagnes,
  notitiesBeschikbaar,
  ingelogd,
  focus,
  onFocus,
  uitlegAan,
}: Props) {
  if (campagnes.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-card px-6 py-10 text-center shadow-card">
        <p className="text-sm text-ink-muted">Geen campagnes gevonden voor deze filters.</p>
      </div>
    );
  }

  /** In focusmodus blijft alles staan, maar treedt de rest terug — geen kolommen die verdwijnen. */
  const demping = (naam: string) =>
    focus && focus !== naam ? "opacity-30 transition-opacity duration-200" : "transition-opacity duration-200";

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
            <col className={uitlegAan ? "w-[260px]" : "w-[148px]"} />
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
                  className={`sticky top-0 z-20 border-b border-line bg-card px-3 py-3 align-top ${demping(c.naam)}`}
                >
                  <CampaignHeader
                    campagne={c}
                    notitiesBeschikbaar={notitiesBeschikbaar}
                    ingelogd={ingelogd}
                    gefocust={focus === c.naam}
                    onFocus={() => onFocus(focus === c.naam ? null : c.naam)}
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
                      className="sticky left-0 z-10 border-b border-line-soft bg-card px-4 py-3 text-left align-top text-sm font-medium text-ink-muted"
                    >
                      {metric.label}
                      {uitlegAan && (
                        <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-faint">
                          {metric.uitleg}
                        </span>
                      )}
                    </th>
                    {campagnes.map((c) => (
                      <td
                        key={c.naam}
                        className={`border-b border-line-soft px-3 py-3 align-top ${demping(c.naam)}`}
                      >
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
