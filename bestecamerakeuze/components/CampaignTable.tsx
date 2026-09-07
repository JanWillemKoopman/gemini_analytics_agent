import { Fragment, type ReactNode } from "react";
import type { Campagne } from "@/lib/sheet";
import {
  budgetRestant,
  formatCurrency,
  formatDate,
  formatNumber,
  percentOfTarget,
  ratio,
} from "@/lib/format";
import BewerkbaarVeld from "@/components/BewerkbaarVeld";
import CampaignHeader from "@/components/CampaignHeader";
import MetricCell, { PlainCell } from "@/components/MetricCell";

type Metric = {
  label: string;
  /** Eén zin in gewone taal: wat staat hier, en waar moet je op letten? Zie "Zo lees je dit". */
  uitleg: string;
  render: (campagne: Campagne) => ReactNode;
  /**
   * Alleen op metrics die een handmatig ingevulde waarde in de sheet zijn — Leads totaal,
   * Leads online en Orders totaal komen ergens anders vandaan en zijn hier bewust nooit
   * bewerkbaar.
   */
  bewerken?: {
    veld: keyof Campagne & string;
    huidigeWaarde: (campagne: Campagne) => string;
    type?: "getal" | "tekst";
  };
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
        bewerken: { veld: "startdatum", huidigeWaarde: (c) => c.startdatum ?? "" },
      },
      {
        label: "Einddatum",
        uitleg:
          "Tot deze dag loopt de campagne. Een campagne die nog loopt heeft logischerwijs nog niet zijn hele doel gehaald.",
        render: (c) => <PlainCell value={formatDate(c.einddatum)} />,
        bewerken: { veld: "einddatum", huidigeWaarde: (c) => c.einddatum ?? "" },
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
        bewerken: {
          veld: "budget",
          huidigeWaarde: (c) => (c.budget !== null ? String(c.budget) : ""),
          type: "getal",
        },
      },
      {
        label: "Uitgaven",
        uitleg:
          "Wat er tot nu toe daadwerkelijk is uitgegeven (kolom “Uitgaven” in de sheet). Eronder staat wat er nog over is, of hoeveel het budget is overschreden.",
        render: (c) => {
          const restant = budgetRestant(c.uitgaven, c.budget);
          return (
            <MetricCell
              primary={formatCurrency(c.uitgaven)}
              secondary={restant?.text}
              tone={restant?.tone}
            />
          );
        },
        bewerken: {
          veld: "uitgaven",
          huidigeWaarde: (c) => (c.uitgaven !== null ? String(c.uitgaven) : ""),
          type: "getal",
        },
      },
    ],
  },
  {
    title: "Leads",
    metrics: [
      {
        label: "Leads totaal",
        uitleg: "Alle leads uit deze campagne, ook die via showroom of telefoon.",
        render: (c) => <PlainCell value={formatNumber(c.leads)} />,
      },
      {
        label: "Doel leads online",
        uitleg: "Het aantal leads dat vooraf is afgesproken voor de hele looptijd.",
        render: (c) => <PlainCell value={formatNumber(c.doelLeads)} />,
        bewerken: {
          veld: "doelLeads",
          huidigeWaarde: (c) => (c.doelLeads !== null ? String(c.doelLeads) : ""),
          type: "getal",
        },
      },
      {
        label: "Leads online",
        uitleg:
          "Het deel van de leads dat online binnenkwam (kolom “Leads marketing” in de sheet) — het stuk waar de campagne zelf direct op stuurt. Eronder: hoeveel procent dat is van het doel.",
        render: (c) => {
          const percent = ratio(c.leadsMarketing, c.doelLeads);
          return (
            <MetricCell
              primary={formatNumber(c.leadsMarketing)}
              secondary={percentOfTarget(c.leadsMarketing, c.doelLeads) ?? undefined}
              progress={percent ?? undefined}
            />
          );
        },
      },
    ],
  },
  {
    title: "Orders",
    metrics: [
      {
        label: "Doel orders totaal",
        uitleg: "Het aantal orders dat vooraf is afgesproken voor de hele looptijd.",
        render: (c) => <PlainCell value={formatNumber(c.doelOrders)} />,
        bewerken: {
          veld: "doelOrders",
          huidigeWaarde: (c) => (c.doelOrders !== null ? String(c.doelOrders) : ""),
          type: "getal",
        },
      },
      {
        label: "Orders totaal",
        uitleg:
          "Getekende orders. Let op: in de sheet staat hier soms een totaal over alle campagnes in plaats van een cijfer per campagne — een bedrag dat te mooi is om waar te zijn, is dat hier meestal ook. Eronder: hoeveel procent dat is van het doel.",
        render: (c) => {
          const percent = ratio(c.orderTotaal, c.doelOrders);
          return (
            <MetricCell
              primary={formatNumber(c.orderTotaal)}
              secondary={percentOfTarget(c.orderTotaal, c.doelOrders) ?? undefined}
              progress={percent ?? undefined}
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
                  className={`sticky top-0 z-20 border-b border-line bg-card px-3 py-3 align-top [border-left:1px_dashed_var(--color-line-soft)] ${demping(c.naam)}`}
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
                    <td
                      key={i}
                      className="border-b border-line-soft bg-surface-tint [border-left:1px_dashed_var(--color-line-soft)]"
                    />
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
                        className={`border-b border-line-soft px-3 py-3 align-top [border-left:1px_dashed_var(--color-line-soft)] ${demping(c.naam)}`}
                      >
                        {metric.bewerken && ingelogd ? (
                          <BewerkbaarVeld
                            campagneNaam={c.naam}
                            veld={metric.bewerken.veld}
                            initieleWaarde={metric.bewerken.huidigeWaarde(c)}
                            type={metric.bewerken.type}
                          >
                            {metric.render(c)}
                          </BewerkbaarVeld>
                        ) : (
                          metric.render(c)
                        )}
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
